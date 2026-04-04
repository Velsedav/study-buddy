import { useState, useEffect, useRef } from 'react';
import { Wrench, Timer, Play } from 'lucide-react';
import { saveMetacognitionLog, getSubjects } from '../lib/db';
import { formatSecondsMMSS } from '../lib/time';
import { getAllChapters } from '../lib/chapters';
import { useSettings } from '../lib/settings';
import { useTranslation } from '../lib/i18n';
import './MetacognitionMode.css';
const STEPS = [
    { id: 1, label: 'Le Recul' },
    { id: 2, label: 'Priorités' },
    { id: 3, label: 'Malaises' },
    { id: 4, label: 'Système' },
    { id: 5, label: 'La Boussole' },
] as const;

const TOTAL_SECONDS = 15 * 60;

export default function MetacognitionMode({ onComplete }: { onComplete: () => void }) {
    const { isTerminal } = useSettings();
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [animKey, setAnimKey] = useState(0);
    const [animClass, setAnimClass] = useState('');
    const prevStepRef = useRef(1);

    const [timerStarted, setTimerStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);

    // Step 2 fields
    const [prioritySubject, setPrioritySubject] = useState('');
    const [examType, setExamType] = useState<'memorisation' | 'comprehension' | 'savoirfaire' | ''>('');

    // Step 3 fields
    const [problem1, setProblem1] = useState('');
    const [problem2, setProblem2] = useState('');
    const [problem3, setProblem3] = useState('');
    const [sacrifice, setSacrifice] = useState('');

    // Step 2 extra fields
    const [freeTimeHours, setFreeTimeHours] = useState('');

    // Step 4 fields
    const [systemRule, setSystemRule] = useState('');

    // Step 5 fields
    const [redChapters, setRedChapters] = useState('');

    // Mention autocomplete
    const [allMentions, setAllMentions] = useState<string[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStart, setMentionStart] = useState(0);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        async function loadMentions() {
            const subjects = await getSubjects();
            const chapters = getAllChapters();
            const names = [
                ...subjects.map(s => s.name),
                ...chapters.map(c => c.name),
            ];
            setAllMentions([...new Set(names)]);
        }
        loadMentions();
    }, []);

    function handleRedChaptersChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        setRedChapters(val);

        const textBeforeCursor = val.slice(0, cursor);
        const match = textBeforeCursor.match(/#([^\n]*)$/);
        if (match) {
            const query = match[1].toLowerCase();
            const start = cursor - match[0].length;
            setMentionStart(start);
            setMentionQuery(match[1]);
            const filtered = allMentions.filter(m => m.toLowerCase().includes(query));
            setSuggestions(filtered.slice(0, 8));
            setDropdownVisible(filtered.length > 0);
            setSelectedSuggestionIdx(0);
        } else {
            setDropdownVisible(false);
            setSuggestions([]);
        }
    }

    function insertMention(name: string) {
        const cursor = textareaRef.current?.selectionStart ?? (mentionStart + 1 + mentionQuery.length);
        const before = redChapters.slice(0, mentionStart);
        const after = redChapters.slice(cursor);
        const newVal = before + name + after;
        setRedChapters(newVal);
        setDropdownVisible(false);
        setSuggestions([]);
        setTimeout(() => {
            const ta = textareaRef.current;
            if (ta) {
                const pos = mentionStart + name.length;
                ta.focus();
                ta.setSelectionRange(pos, pos);
            }
        }, 0);
    }

    function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (!dropdownVisible) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestionIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (suggestions[selectedSuggestionIdx]) {
                e.preventDefault();
                insertMention(suggestions[selectedSuggestionIdx]);
            }
        } else if (e.key === 'Escape') {
            setDropdownVisible(false);
        }
    }

    useEffect(() => {
        if (!timerStarted || timeLeft <= 0) return;
        const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(id);
    }, [timerStarted, timeLeft]);

    useEffect(() => {
        if (timeLeft <= 0 && timerStarted) {
            handleSaveAndComplete();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft]);

    const goToStep = (newStep: number) => {
        if (newStep === step) return;
        const dir = newStep > step ? 'mc-slide-forward' : 'mc-slide-backward';
        prevStepRef.current = step;
        setAnimClass(dir);
        setAnimKey(k => k + 1);
        setStep(newStep);
    };

    const handleSaveAndComplete = async () => { try {
        const examTypeLabels: Record<string, string> = {
            memorisation: 'Mémorisation',
            comprehension: 'Compréhension',
            savoirfaire: 'Savoir-faire',
        };

        const memorizationAlignValue = [
            prioritySubject && `Matière : ${prioritySubject}`,
            examType && `Type : ${examTypeLabels[examType]}`,
        ].filter(Boolean).join(' | ');

        const focusDropValue = [
            problem1 && `P1: ${problem1}`,
            problem2 && `P2: ${problem2}`,
            problem3 && `P3: ${problem3}`,
            sacrifice && `Sacrifice: ${sacrifice}`,
        ].filter(Boolean).join('\n');

        await saveMetacognitionLog({
            retention: redChapters,
            focus_drop: focusDropValue,
            memorization_align: memorizationAlignValue,
            mechanical_fix: systemRule,
            free_time_hours: freeTimeHours ? parseFloat(freeTimeHours) : null,
            priority_subject_ids: null,
        });

        // Reset state
        setStep(1);
        setAnimKey(0);
        setAnimClass('');
        prevStepRef.current = 1;
        setPrioritySubject('');
        setExamType('');
        setProblem1('');
        setProblem2('');
        setProblem3('');
        setSacrifice('');
        setSystemRule('');
        setFreeTimeHours('');
        setRedChapters('');
        setTimerStarted(false);
        setTimeLeft(TOTAL_SECONDS);
        onComplete();
    } catch (e) { console.error('handleSaveAndComplete failed:', e); } };

    return (
        <div className="metacognition-page fade-in" style={{
            display: 'flex', flexDirection: 'column',
            width: '100%', maxWidth: '800px', margin: '0 auto',
            paddingTop: '20px', paddingBottom: '60px',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '16px', color: 'var(--primary)' }}>
                        <Wrench size={28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Prise de recul Métacognitif</h1>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                            Étudier comment tu étudies · 15 min
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {timerStarted && step < 5 && (
                        <div style={{
                            background: timeLeft < 120 ? 'rgba(var(--danger-rgb), 0.15)' : 'var(--card-bg)',
                            border: `1px solid ${timeLeft < 120 ? 'var(--danger)' : 'var(--glass-border)'}`,
                            borderRadius: '12px', padding: '8px 16px',
                            fontWeight: 'bold', fontSize: '1.1rem',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            color: timeLeft < 120 ? 'var(--danger)' : 'var(--text-dark)',
                            fontVariantNumeric: 'tabular-nums',
                            transition: 'all 0.3s ease'
                        }}>
                            <Timer size={18} />
                            {formatSecondsMMSS(timeLeft)}
                        </div>
                    )}
                    <button className="btn btn-secondary" onClick={handleSaveAndComplete} style={{ fontSize: '0.9rem' }}>
                        Quitter
                    </button>
                </div>
            </div>

            {/* Step Navigation Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
                {STEPS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => goToStep(s.id)}
                        className={`mc-step-pill${step === s.id ? ' active' : ''}`}
                    >
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>Étape {s.id}</span>
                        <span>{s.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div style={{ position: 'relative', width: '100%', minHeight: '400px' }}>
                <div key={animKey} className={`mc-anim-wrapper ${animClass}`} style={{ width: '100%' }}>

                    {/* ── Step 1: Le Recul ── */}
                    {step === 1 && (
                        <div className="glass" style={{ padding: '48px', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{isTerminal ? '[!]' : '🛑'}</div>
                            <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>Le Recul</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '24px', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 24px auto' }}>
                                C'est la fin de la semaine. On stop tout un instant !<br />
                                Prenons 15 minutes pour évaluer ton système et préparer la semaine prochaine.
                            </p>
                            <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: '12px', padding: '24px', marginBottom: '32px', lineHeight: 1.75, textAlign: 'left' }}>
                                <p style={{ margin: 0 }}>
                                    <strong>Instruction :</strong> Déconnecte-toi totalement de tes cours pendant 15 minutes. Ferme tes livres, tes notes, ton téléphone. Tu ne révises plus de matière ; <strong>tu analyses ton système.</strong>
                                </p>
                            </div>
                            {!timerStarted ? (
                                <button
                                    className="btn btn-primary"
                                    style={{ fontSize: '1.1rem', padding: '16px 36px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}
                                    onClick={() => { setTimerStarted(true); goToStep(2); }}
                                >
                                    <Play size={20} />
                                    Démarrer l'évaluation (15 min)
                                </button>
                            ) : (
                                <button className="btn btn-secondary" style={{ padding: '12px 32px' }} onClick={() => goToStep(2)}>
                                    Continuer →
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Step 2: Priorités ── */}
                    {step === 2 && (
                        <div className="glass" style={{ padding: '40px' }}>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{isTerminal ? '[>]' : '🎯'} Pression Majeure</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Quelle est ton échéance ou ta matière la plus pressante cette semaine ? De quoi auras-tu besoin à l'examen ?
                            </p>

                            <div className="form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>Matière / Échéance :</label>
                                <input
                                    className="mc-input"
                                    value={prioritySubject}
                                    onChange={e => setPrioritySubject(e.target.value)}
                                    placeholder="Ex: Partiel d'Anatomie du 15 Octobre"
                                    style={{ fontSize: '1rem', padding: '12px 16px' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ fontWeight: 600, marginBottom: '16px', display: 'block' }}>Type d'évaluation attendu :</label>
                                <div className="mc-exam-type-grid">
                                    {[
                                        { id: 'memorisation', icon: '🧠', terminalIcon: '[M]', label: 'Mémorisation Pure', desc: 'QCM, Dates, Vocabulaire' },
                                        { id: 'comprehension', icon: '💡', terminalIcon: '[C]', label: 'Compréhension', desc: 'Concepts, Liens logiques, Théorie' },
                                        { id: 'savoirfaire', icon: '✍️', terminalIcon: '[F]', label: 'Savoir-Faire', desc: 'Exercices, Rédaction, Pratique' }
                                    ].map(type => (
                                        <div
                                            key={type.id}
                                            onClick={() => setExamType(type.id as any)}
                                            className={`mc-exam-type-card${examType === type.id ? ' active' : ''}`}
                                        >
                                            <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{isTerminal ? type.terminalIcon : type.icon}</div>
                                            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '6px' }}>{type.label}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{type.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mc-free-time-group">
                                <label className="mc-free-time-label">
                                    {isTerminal ? '[T]' : '⏳'} {t('metacog.free_time_label')}
                                </label>
                                <p className="mc-free-time-desc">
                                    {t('metacog.free_time_desc')}
                                </p>
                                <div className="mc-free-time-input-row">
                                    <input
                                        className="mc-input mc-free-time-input"
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        max="168"
                                        step="0.5"
                                        value={freeTimeHours}
                                        onChange={e => setFreeTimeHours(e.target.value)}
                                        placeholder={t('metacog.free_time_placeholder')}
                                    />
                                    <span className="mc-free-time-unit">{t('metacog.free_time_unit')}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                                <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => goToStep(3)}>
                                    Étape Suivante →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Les Malaises ── */}
                    {step === 3 && (
                        <div className="glass" style={{ padding: '40px' }}>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{isTerminal ? '[#]' : '🧱'} Les Obstacles</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Identifions ce qui ne fonctionne pas actuellement pour que tu puisses t'adapter.
                            </p>

                            <div className="form-group" style={{ marginBottom: '32px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '16px', display: 'block' }}>{isTerminal ? '[!]' : '⚠️'} Quels sont les 3 problèmes majeurs de ta semaine passée ?</label>
                                {[
                                    { val: problem1, set: setProblem1, p: '1. Ex: Je repousse toujours mes fiches...' },
                                    { val: problem2, set: setProblem2, p: '2. Ex: Je suis distrait par mon téléphone...' },
                                    { val: problem3, set: setProblem3, p: '3. Ex: Je dors trop peu...' }
                                ].map((prob, i) => (
                                    <input key={i} className="mc-input" value={prob.val} onChange={e => prob.set(e.target.value)} placeholder={prob.p} style={{ marginBottom: '12px', fontSize: '0.95rem' }} />
                                ))}
                            </div>

                            <div className="form-group" style={{ background: 'rgba(var(--danger-rgb), 0.07)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(var(--danger-rgb), 0.2)' }}>
                                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>{isTerminal ? '[-]' : '🔪'} Le Sacrifice Invisible</label>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                                    Qu'est-ce qui n'a servi <em>ni</em> à tes études, <em>ni</em> à ta vie personnelle ?
                                </p>
                                <input className="mc-input" value={sacrifice} onChange={e => setSacrifice(e.target.value)} placeholder="Ex: 2h de scroll inutile, vidéos sans intention..." style={{ fontSize: '0.95rem' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                                <button className="btn btn-secondary" onClick={() => goToStep(2)}>← Retour</button>
                                <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => goToStep(4)}>Étape Suivante →</button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Le Système ── */}
                    {step === 4 && (
                        <div className="glass" style={{ padding: '40px' }}>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{isTerminal ? '[*]' : '⚙️'} Mise à Jour du Système</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Le design de ton environnement est plus important que ta volonté. Crée une règle stricte.
                            </p>

                            <div className="form-group">
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
                                    {isTerminal ? '[L]' : '🔒'} Quelle règle système vas-tu imposer pour ta prochaine session ?
                                </label>
                                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                        Ex: "Je travaille même dans le train" · "Téléphone dans une autre pièce" · "Démarrer par l'exercice le plus dur"
                                    </p>
                                </div>
                                <textarea
                                    className="mc-input"
                                    rows={5}
                                    value={systemRule}
                                    onChange={e => setSystemRule(e.target.value)}
                                    placeholder="Ta nouvelle règle système ici..."
                                    style={{ resize: 'vertical', width: '100%', fontSize: '1rem', padding: '16px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                                <button className="btn btn-secondary" onClick={() => goToStep(3)}>← Retour</button>
                                <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => goToStep(5)}>Dernière Étape →</button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 5: La Boussole ── */}
                    {step === 5 && (
                        <div className="glass" style={{ padding: '40px' }}>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{isTerminal ? '[N]' : '🧭'} La Boussole</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Mets à jour ton suivi visuel pour savoir où diriger tes efforts demain.
                            </p>

                            <div className="form-group">
                                <label style={{ fontWeight: 600, marginBottom: '16px', display: 'block' }}>
                                    {isTerminal ? '[F]' : '✍️'} Quels chapitres ou objectifs sont actuellement en "Rouge" (non maîtrisés) ?
                                </label>
                                <div className="mc-mention-wrapper">
                                    <textarea
                                        ref={textareaRef}
                                        className="mc-input mc-boussole-textarea"
                                        rows={8}
                                        value={redChapters}
                                        onChange={handleRedChaptersChange}
                                        onKeyDown={handleTextareaKeyDown}
                                        placeholder="Liste tes zones de danger ici... (tape # pour mentionner une matière ou un chapitre)"
                                    />
                                    {dropdownVisible && suggestions.length > 0 && (
                                        <div className="mc-mention-dropdown">
                                            {suggestions.map((name, i) => (
                                                <button
                                                    key={name}
                                                    className={`mc-mention-item${i === selectedSuggestionIdx ? ' mc-mention-item--active' : ''}`}
                                                    onMouseDown={e => { e.preventDefault(); insertMention(name); }}
                                                >
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mc-complete-actions">
                                <button className="btn btn-secondary" onClick={() => goToStep(4)}>← Retour</button>
                                <button
                                    className="btn btn-primary mc-complete-btn"
                                    onClick={handleSaveAndComplete}
                                >
                                    ✅ Compléter le Pit Stop
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
