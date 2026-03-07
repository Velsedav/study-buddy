import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { formatSecondsMMSS } from '../lib/time';
import { updateSubjectStats, saveSession } from '../lib/db';
import { TECHNIQUES } from '../lib/techniques';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { METACOGNITION_QUESTIONS } from '../lib/metacognitionQuestions';
import { getChaptersForSubject, incrementStudyCount } from '../lib/chapters';

interface PrepItem {
    emoji: string;
    label: string;
    url?: string;
}

const PREP_CHECKLIST: PrepItem[] = [
    { emoji: '📵', label: 'Tél. éteint & rangé' },
    { emoji: '🥤', label: 'Eau prête' },
    { emoji: '🧹', label: 'Onglets et fenêtres inutiles fermés' },
    { emoji: '🧘', label: 'Respiration 3–5 min', url: 'https://www.youtube.com/watch?v=1h_q1u9jncs' },
    { emoji: '🔊', label: 'Bruit blanc', url: 'https://asoftmurmur.com/' },
    { emoji: '👥', label: 'Body Doubling (Soutien psychologique)' },
    { emoji: '🧦', label: 'Grosses chaussettes (Confort thermique)' },
];

const CUSTOM_PREP_KEY = 'study-buddy-custom-prep';

function loadCustomPrepItems(): PrepItem[] {
    try {
        const saved = localStorage.getItem(CUSTOM_PREP_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return [];
}

function saveCustomPrepItems(items: PrepItem[]) {
    localStorage.setItem(CUSTOM_PREP_KEY, JSON.stringify(items));
}

export default function Session() {
    const navigate = useNavigate();
    const [session, setSession] = useState<any>(null);
    const [remaining, setRemaining] = useState(0);
    const [paused, setPaused] = useState(false);
    const [completedWorkMinutes, setCompletedWorkMinutes] = useState<Record<string, number>>({});
    const [customPrepItems, setCustomPrepItems] = useState<PrepItem[]>(loadCustomPrepItems);
    const allPrepItems = [...PREP_CHECKLIST, ...customPrepItems];
    const [checkedItems, setCheckedItems] = useState<boolean[]>(allPrepItems.map(() => false));
    const [endConfirmStep, setEndConfirmStep] = useState<'none' | 'confirm-stop' | 'confirm-save' | 'total-rest'>('none');
    const [newCustomItem, setNewCustomItem] = useState('');
    const { theme } = useSettings();

    useEffect(() => {
        const stored = localStorage.getItem('activeSession');
        if (stored) {
            const parsed = JSON.parse(stored);
            setSession(parsed);
            setRemaining(parsed.remainingSeconds);
            setPaused(parsed.paused || false);
        }
    }, []);

    // Sync remaining/paused back to localStorage 
    useEffect(() => {
        if (!session) return;
        localStorage.setItem('activeSession', JSON.stringify({
            ...session,
            remainingSeconds: remaining,
            paused
        }));
    }, [remaining, paused, session]);

    // Timer loop
    useEffect(() => {
        if (!session || paused) return;

        const interval = setInterval(() => {
            setRemaining(r => {
                if (r <= 1) {
                    handleBlockComplete();
                    return 0; // Temporary before next block sets it
                }
                return r - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, paused]);

    // 10s Cooldown Warning Sound
    useEffect(() => {
        if (remaining === 10 && !paused) {
            playSFX('10sec-cooldown', theme);
        }
    }, [remaining, paused, theme]);

    async function handleBlockComplete() {
        if (!session) return;
        const currentBlock = session.draft[session.nowBlockIdx];

        // Accumulate work minutes implicitly
        if (currentBlock.type === 'WORK' && currentBlock.subject_id) {
            setCompletedWorkMinutes(prev => ({
                ...prev,
                [currentBlock.subject_id]: (prev[currentBlock.subject_id] || 0) + currentBlock.minutes
            }));
        }

        const nextIdx = session.nowBlockIdx + 1;
        if (nextIdx >= session.draft.length) {
            handleSessionComplete();
        } else {
            playSFX('10sec-cooldown', theme); // Sound for switching task into a block
            const newSession = {
                ...session,
                nowBlockIdx: nextIdx,
            };
            setSession(newSession);
            setRemaining(session.draft[nextIdx].minutes * 60);
        }
    }
    function handleSessionComplete() {
        playSFX('pause_theme', theme);
        setEndConfirmStep('total-rest');
        setPaused(true);
    }

    async function finishSession(completedAll = false, saveProgress = true) {
        if (!session) return;

        if (saveProgress) {
            const endedAt = new Date().toISOString();

            // Calculate final actual minutes
            let actualMins = 0;
            for (let i = 0; i <= session.nowBlockIdx; i++) {
                if (i < session.nowBlockIdx) {
                    actualMins += session.draft[i].minutes;
                } else {
                    actualMins += Math.floor((session.draft[i].minutes * 60 - remaining) / 60);
                }
            }

            const currentBlock = session.draft[session.nowBlockIdx];
            const finalCompletedWork = { ...completedWorkMinutes };
            // Partial work block completion
            if (!completedAll && currentBlock.type === 'WORK' && currentBlock.subject_id) {
                const partialMins = Math.floor((currentBlock.minutes * 60 - remaining) / 60);
                finalCompletedWork[currentBlock.subject_id] = (finalCompletedWork[currentBlock.subject_id] || 0) + partialMins;
            }

            // Save session to DB
            await saveSession({
                id: session.sessionId,
                started_at: session.startedAt,
                ended_at: endedAt,
                template: session.template,
                repeats: session.repeats,
                planned_minutes: session.plannedMinutes,
                actual_minutes: actualMins
            }, session.draft);

            // Update subjects
            for (const [subjId, mins] of Object.entries(finalCompletedWork)) {
                if (mins > 0) {
                    await updateSubjectStats(subjId, mins as number, endedAt);
                }
            }

            // Track completed chapters
            const completedChapterIds = new Set<string>();

            for (let i = 0; i <= session.nowBlockIdx; i++) {
                const block = session.draft[i];
                if (block.type === 'WORK' && block.subject_id && block.chapter_name) {
                    const isCurrent = i === session.nowBlockIdx;
                    let mins = block.minutes;
                    if (isCurrent && !completedAll) {
                        mins = Math.floor((block.minutes * 60 - remaining) / 60);
                    }
                    if (mins > 0) {
                        const chaps = getChaptersForSubject(block.subject_id);
                        const ch = chaps.find(c => c.name === block.chapter_name);
                        if (ch) completedChapterIds.add(ch.id);
                    }
                }
            }

            for (const id of completedChapterIds) {
                incrementStudyCount(id);
            }
        }

        localStorage.removeItem('activeSession');
        setEndConfirmStep('none');
        navigate('/');
    }

    if (!session) {
        return (
            <div className="session-page" style={{ textAlign: 'center', marginTop: '100px' }}>
                <h2>No Active Session</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Draft a plan in the Planner to start studying!</p>
                <Link to="/plan" className="btn btn-primary">Open Planner</Link>
            </div>
        );
    }

    const currentBlock = session.draft[session.nowBlockIdx];
    const tech = currentBlock.technique_id ? TECHNIQUES.find(t => t.id === currentBlock.technique_id) : null;

    return (
        <div className="session-page" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh'
        }}>
            <div className="glass" style={{
                padding: '60px',
                textAlign: 'center',
                width: '100%',
                maxWidth: '600px',
                borderRadius: '32px'
            }}>
                <h2 style={{ color: 'var(--primary-hover)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    {currentBlock.type}
                </h2>

                {currentBlock.type === 'WORK' && (
                    <div style={{ margin: '12px 0' }}>
                        {currentBlock.chapter_name && (
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                marginBottom: '8px',
                                textAlign: 'left',
                                maxWidth: '400px',
                                marginLeft: 'auto',
                                marginRight: 'auto'
                            }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>📖 Chapter</div>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{currentBlock.chapter_name}</div>
                            </div>
                        )}
                        {currentBlock.objective && (
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                marginBottom: '8px',
                                textAlign: 'left',
                                maxWidth: '400px',
                                marginLeft: 'auto',
                                marginRight: 'auto'
                            }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>🎯 Objective</div>
                                <div style={{ fontSize: '1rem' }}>{currentBlock.objective}</div>
                            </div>
                        )}
                        {tech ? (
                            <div style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                                <strong>{tech.name}</strong>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{tech.hint}</div>
                            </div>
                        ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Focus time</span>
                        )}

                        {/* Metacognition Reminder */}
                        {currentBlock.technique_id && METACOGNITION_QUESTIONS[currentBlock.technique_id] && (
                            <div style={{
                                background: METACOGNITION_QUESTIONS[currentBlock.technique_id].tier === 'F' || METACOGNITION_QUESTIONS[currentBlock.technique_id].tier === 'D'
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : 'rgba(var(--primary-rgb), 0.06)',
                                border: METACOGNITION_QUESTIONS[currentBlock.technique_id].tier === 'F' || METACOGNITION_QUESTIONS[currentBlock.technique_id].tier === 'D'
                                    ? '1px solid rgba(239, 68, 68, 0.2)'
                                    : '1px solid rgba(var(--primary-rgb), 0.15)',
                                borderRadius: '12px',
                                padding: '14px 18px',
                                marginTop: '16px',
                                maxWidth: '420px',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                                textAlign: 'left',
                            }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>🧠 Metacognition Check</div>
                                {METACOGNITION_QUESTIONS[currentBlock.technique_id].questions.map((q, qi) => (
                                    <div key={qi} style={{
                                        fontSize: '0.85rem',
                                        fontStyle: 'italic',
                                        color: 'var(--text-dark)',
                                        marginBottom: qi < METACOGNITION_QUESTIONS[currentBlock.technique_id].questions.length - 1 ? '6px' : 0,
                                        lineHeight: '1.4',
                                    }}>{q}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentBlock.type === 'PREP' && (
                    <div style={{
                        textAlign: 'left',
                        margin: '16px auto',
                        maxWidth: '380px',
                        background: 'var(--card-bg)',
                        borderRadius: '16px',
                        padding: '20px 24px'
                    }}>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '12px' }}>✨ Checklist de préparation</div>
                        {allPrepItems.map((item, idx) => (
                            <label
                                key={idx}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 4px',
                                    cursor: 'pointer',
                                    borderBottom: idx < allPrepItems.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                                    opacity: checkedItems[idx] ? 0.5 : 1,
                                    textDecoration: checkedItems[idx] ? 'line-through' : 'none',
                                    transition: 'opacity 0.2s ease'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checkedItems[idx] || false}
                                    onChange={() => {
                                        const next = [...checkedItems];
                                        next[idx] = !next[idx];
                                        setCheckedItems(next);
                                        if (next[idx]) {
                                            playSFX('checklist_sound', theme);
                                        }
                                    }}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontSize: '1rem', flex: 1 }}>
                                    {item.emoji} {item.url ? (
                                        <a
                                            href="#"
                                            onClick={e => { e.preventDefault(); e.stopPropagation(); openExternal(item.url!); }}
                                            style={{ color: 'var(--primary-hover)', fontWeight: 'bold', textDecoration: 'underline' }}
                                        >
                                            {item.label}
                                        </a>
                                    ) : item.label}
                                </span>
                                {/* Remove button for custom items */}
                                {idx >= PREP_CHECKLIST.length && (
                                    <button
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem', padding: '2px' }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const customIdx = idx - PREP_CHECKLIST.length;
                                            const newCustom = customPrepItems.filter((_, i) => i !== customIdx);
                                            setCustomPrepItems(newCustom);
                                            saveCustomPrepItems(newCustom);
                                            const newChecked = [...checkedItems];
                                            newChecked.splice(idx, 1);
                                            setCheckedItems(newChecked);
                                        }}
                                        title="Remove custom item"
                                    >
                                        ✕
                                    </button>
                                )}
                            </label>
                        ))}

                        {/* Add custom item */}
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Add custom item..."
                                value={newCustomItem}
                                onChange={e => setNewCustomItem(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newCustomItem.trim()) {
                                        const newItem: PrepItem = { emoji: '📌', label: newCustomItem.trim() };
                                        const newCustom = [...customPrepItems, newItem];
                                        setCustomPrepItems(newCustom);
                                        saveCustomPrepItems(newCustom);
                                        setCheckedItems([...checkedItems, false]);
                                        setNewCustomItem('');
                                    }
                                }}
                                style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem', borderRadius: '8px' }}
                            />
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                onClick={() => {
                                    if (newCustomItem.trim()) {
                                        const newItem: PrepItem = { emoji: '📌', label: newCustomItem.trim() };
                                        const newCustom = [...customPrepItems, newItem];
                                        setCustomPrepItems(newCustom);
                                        saveCustomPrepItems(newCustom);
                                        setCheckedItems([...checkedItems, false]);
                                        setNewCustomItem('');
                                    }
                                }}
                            >
                                + Add
                            </button>
                        </div>
                    </div>
                )}

                <div style={{
                    fontSize: '7rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'monospace',
                    color: paused ? 'var(--text-muted)' : 'var(--text-dark)',
                    margin: '24px 0',
                    textShadow: '2px 4px 12px rgba(var(--primary-rgb), 0.3)'
                }}>
                    {formatSecondsMMSS(remaining)}
                </div>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '32px' }}>
                    <button
                        className={`btn ${paused ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setPaused(!paused)}
                        style={{ minWidth: '120px' }}
                    >
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleBlockComplete()}>
                        Skip Block
                    </button>
                    <button
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--danger)',
                            border: '2px solid var(--danger)'
                        }}
                        onClick={() => {
                            setPaused(true);
                            setEndConfirmStep('confirm-stop');
                        }}
                    >
                        End Session
                    </button>
                </div>
            </div>

            {/* Mini timeline */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '40px',
                flexWrap: 'wrap',
                maxWidth: '800px',
                justifyContent: 'center'
            }}>
                {session.draft.map((b: any, i: number) => {
                    const isActive = i === session.nowBlockIdx;
                    const isDone = i < session.nowBlockIdx;
                    let bg = 'rgba(255,255,255,0.5)';
                    if (isActive) bg = 'var(--primary)';
                    else if (isDone) bg = 'var(--success)';

                    return (
                        <div
                            key={i}
                            title={`${b.type} - ${b.minutes}m`}
                            style={{
                                width: isActive ? '32px' : '16px',
                                height: '16px',
                                borderRadius: '8px',
                                background: bg,
                                transition: 'all 0.3s ease',
                                boxShadow: isActive ? '0 0 12px var(--primary)' : 'none'
                            }}
                        />
                    );
                })}
            </div>

            {/* End Session Confirmation Modal */}
            {endConfirmStep !== 'none' && (
                <div className="modal-overlay" onClick={() => { setEndConfirmStep('none'); setPaused(false); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
                        {endConfirmStep === 'confirm-stop' && (
                            <>
                                <h2 style={{ marginBottom: '12px' }}>⏸️ Stop studying?</h2>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                                    Are you sure you want to end this session early?
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button className="btn btn-primary" onClick={() => { setEndConfirmStep('none'); setPaused(false); }}>
                                        Keep studying
                                    </button>
                                    <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => setEndConfirmStep('confirm-save')}>
                                        Yes, stop
                                    </button>
                                </div>
                            </>
                        )}

                        {endConfirmStep === 'confirm-save' && (
                            <>
                                <h2 style={{ marginBottom: '12px' }}>💾 Save your progress?</h2>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                                    Do you want to record the time you studied so far during this session?
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button className="btn btn-primary" onClick={() => finishSession(false, true)}>
                                        Save progress
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => finishSession(false, false)}>
                                        Discard
                                    </button>
                                </div>
                            </>
                        )}

                        {endConfirmStep === 'total-rest' && (
                            <div style={{ padding: '24px 0' }}>
                                <h2 style={{ marginBottom: '16px', fontSize: '2rem', color: 'var(--primary-hover)' }}>🛑 TOTAL REST!</h2>
                                <p style={{ color: 'var(--text-dark)', marginBottom: '16px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                    Session Complete.
                                </p>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1.1rem', lineHeight: '1.6' }}>
                                    Recommendation: Lie down for 10 minutes.<br />
                                    Do absolutely NOTHING right now. No phone, no scrolling, no planning.<br /><br />Let your mind process what you just learned.
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button className="btn btn-primary btn-holographic" onClick={() => finishSession(true, true)} style={{ padding: '12px 32px', fontSize: '1.2rem' }}>
                                        I am rested. Close session.
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
