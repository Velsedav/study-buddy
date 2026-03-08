import { useState, useEffect, useRef } from 'react';
import { Wrench, Timer, Play } from 'lucide-react';
import { saveMetacognitionLog } from '../lib/db';
import { formatSecondsMMSS } from '../lib/time';
const STEPS = [
    { id: 1, label: 'Le Recul' },
    { id: 2, label: 'Priorités' },
    { id: 3, label: 'Malaises' },
    { id: 4, label: 'Système' },
    { id: 5, label: 'La Boussole' },
] as const;

const TOTAL_SECONDS = 15 * 60;

export default function MetacognitionMode({ onComplete }: { onComplete: () => void }) {
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

    // Step 4 fields
    const [systemRule, setSystemRule] = useState('');

    // Step 5 fields
    const [redChapters, setRedChapters] = useState('');

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

    const handleSaveAndComplete = async () => {
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
        setRedChapters('');
        setTimerStarted(false);
        setTimeLeft(TOTAL_SECONDS);
        onComplete();
    };

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
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Pit Stop Métacognitif</h1>
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
                        style={{
                            flex: 1, maxWidth: '120px', padding: '10px 8px', borderRadius: '12px',
                            border: step === s.id ? '2px solid var(--primary)' : '2px solid var(--glass-border)',
                            background: step === s.id ? 'rgba(var(--primary-rgb), 0.12)' : 'var(--card-bg)',
                            color: step === s.id ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: step === s.id ? 700 : 500, fontSize: '0.85rem',
                            cursor: 'pointer', transition: 'all 0.2s ease',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                        }}
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
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🛑</div>
                            <h2 style={{ fontSize: '1.8rem', marginBottom: '16px' }}>Le Recul</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '24px', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 24px auto' }}>
                                C'est la fin de la semaine. Pas plus de travail aujourd'hui !<br />
                                Prenons 15 minutes pour évaluer ton système et préparer la semaine prochaine.
                            </p>
                            <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: '12px', padding: '24px', marginBottom: '32px', lineHeight: 1.75, textAlign: 'left' }}>
                                <p style={{ margin: 0 }}>
                                    <strong>Instruction :</strong> Déconnecte-toi totalement de tes cours pendant 15 minutes. Ferme tes livres, tes notes, ton téléphone. Tu ne révises plus une matière ; <strong>tu analyses ton système.</strong>
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
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>🎯 Pression Majeure</h2>
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                                    {[
                                        { id: 'memorisation', icon: '🧠', label: 'Mémorisation Pure', desc: 'QCM, Dates, Vocabulaire' },
                                        { id: 'comprehension', icon: '💡', label: 'Compréhension', desc: 'Concepts, Liens logiques, Théorie' },
                                        { id: 'savoirfaire', icon: '✍️', label: 'Savoir-Faire', desc: 'Exercices, Rédaction, Pratique' }
                                    ].map(type => (
                                        <div
                                            key={type.id}
                                            onClick={() => setExamType(type.id as any)}
                                            style={{
                                                padding: '24px 16px', borderRadius: '16px', cursor: 'pointer',
                                                border: examType === type.id ? '2px solid var(--primary)' : '2px solid transparent',
                                                background: examType === type.id ? 'rgba(var(--primary-rgb), 0.08)' : 'var(--bg)',
                                                transition: 'all 0.2s ease', textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{type.icon}</div>
                                            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '6px' }}>{type.label}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{type.desc}</div>
                                        </div>
                                    ))}
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
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>🧱 Les Obstacles</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Identifions ce qui ne fonctionne pas actuellement pour que tu puisses t'adapter.
                            </p>

                            <div className="form-group" style={{ marginBottom: '32px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '16px', display: 'block' }}>⚠️ Quels sont les 3 problèmes majeurs de ta semaine passée ?</label>
                                {[
                                    { val: problem1, set: setProblem1, p: '1. Ex: Je repousse toujours mes fiches...' },
                                    { val: problem2, set: setProblem2, p: '2. Ex: Je suis distrait par mon téléphone...' },
                                    { val: problem3, set: setProblem3, p: '3. Ex: Je dors trop peu...' }
                                ].map((prob, i) => (
                                    <input key={i} className="mc-input" value={prob.val} onChange={e => prob.set(e.target.value)} placeholder={prob.p} style={{ marginBottom: '12px', fontSize: '0.95rem' }} />
                                ))}
                            </div>

                            <div className="form-group" style={{ background: 'rgba(var(--danger-rgb), 0.07)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(var(--danger-rgb), 0.2)' }}>
                                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>🔪 Le Sacrifice Invisible</label>
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
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>⚙️ Mise à Jour du Système</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Le design de ton environnement bat ta volonté. Crée une règle stricte.
                            </p>

                            <div className="form-group">
                                <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
                                    🔒 Quelle règle système vas-tu imposer pour ta prochaine session ?
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
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>🧭 La Boussole</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
                                Mets à jour ton suivi visuel pour savoir où diriger tes efforts demain.
                            </p>

                            <div className="form-group">
                                <label style={{ fontWeight: 600, marginBottom: '16px', display: 'block' }}>
                                    ✍️ Quels chapitres ou objectifs sont actuellement en "Rouge" (non maîtrisés) ?
                                </label>
                                <textarea
                                    className="mc-input"
                                    rows={8}
                                    value={redChapters}
                                    onChange={e => setRedChapters(e.target.value)}
                                    placeholder="Liste tes zones de danger ici..."
                                    style={{ resize: 'vertical', width: '100%', fontSize: '1rem', padding: '16px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                                <button className="btn btn-secondary" onClick={() => goToStep(4)}>← Retour</button>
                                <button
                                    className="btn btn-primary"
                                    style={{ fontSize: '1.05rem', padding: '14px 40px', background: 'var(--success)' }}
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
