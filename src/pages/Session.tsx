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
import './Session.css';

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
    { emoji: '🍇', label: 'Préparer un snack sain' },
    { emoji: '🧹', label: 'Désencombrer mon espace de travail' },
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
    const [restCountdown, setRestCountdown] = useState(600); // 10 minutes in seconds
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

    // Timer loop: only counts down, never triggers side effects
    useEffect(() => {
        if (!session || paused) return;

        const interval = setInterval(() => {
            setRemaining(r => Math.max(r - 1, 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [session, paused]);

    // Block completion: fires when the countdown hits 0
    // Kept separate from the updater to respect React's pure-updater rule
    useEffect(() => {
        if (remaining === 0 && session && !paused) {
            handleBlockComplete();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remaining]);

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
        setRestCountdown(600);
        setEndConfirmStep('total-rest');
        setPaused(true);
    }

    // Rest countdown
    useEffect(() => {
        if (endConfirmStep !== 'total-rest') return;
        if (restCountdown <= 0) return;
        const t = setTimeout(() => setRestCountdown(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [endConfirmStep, restCountdown]);

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
            <div className="session-page session-page-container">
                <h2>No Active Session</h2>
                <p className="session-no-active-text">Draft a plan in the Planner to start studying!</p>
                <Link to="/plan" className="btn btn-primary">Open Planner</Link>
            </div>
        );
    }

    const currentBlock = session.draft[session.nowBlockIdx];
    const tech = currentBlock.technique_id ? TECHNIQUES.find(t => t.id === currentBlock.technique_id) : null;

    return (
        <div className="session-page session-main-container">
            <div className="glass session-panel">
                <h2 className="session-block-type">
                    {currentBlock.type}
                </h2>

                {currentBlock.type === 'WORK' && (
                    <div className="session-work-container">
                        {currentBlock.chapter_name && (
                            <div className="session-info-card">
                                <div className="session-info-label">📖 Chapter</div>
                                <div className="session-info-value">{currentBlock.chapter_name}</div>
                            </div>
                        )}
                        {currentBlock.objective && (
                            <div className="session-info-card">
                                <div className="session-info-label">🎯 Objective</div>
                                <div className="session-info-value">{currentBlock.objective}</div>
                            </div>
                        )}
                        {tech ? (
                            <div className="session-tech-card">
                                <strong>{tech.name}</strong>
                                <div className="session-tech-hint">{tech.hint}</div>
                            </div>
                        ) : (
                            <span className="session-focus-text">Focus time</span>
                        )}

                        {/* Metacognition Reminder */}
                        {currentBlock.technique_id && METACOGNITION_QUESTIONS[currentBlock.technique_id] && (
                            <div className={`meta-check-card ${METACOGNITION_QUESTIONS[currentBlock.technique_id].tier === 'F' || METACOGNITION_QUESTIONS[currentBlock.technique_id].tier === 'D' ? 'warning' : 'normal'}`}>
                                <div className="meta-check-label">🧠 Metacognition Check</div>
                                {METACOGNITION_QUESTIONS[currentBlock.technique_id].questions.map((q, qi) => (
                                    <div key={qi} className={`meta-check-question ${qi < METACOGNITION_QUESTIONS[currentBlock.technique_id].questions.length - 1 ? 'spaced' : ''}`}>
                                        {q}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentBlock.type === 'PREP' && (
                    <div className="prep-checklist-card">
                        <div className="prep-checklist-title">✨ Checklist de préparation</div>
                        {allPrepItems.map((item, idx) => (
                            <label
                                key={idx}
                                className={`prep-item-label ${idx < allPrepItems.length - 1 ? 'bordered' : ''} ${checkedItems[idx] ? 'checked' : ''}`}
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
                                    className="prep-item-checkbox"
                                />
                                <span className="prep-item-text">
                                    {item.emoji} {item.url ? (
                                        <a
                                            href="#"
                                            onClick={e => { e.preventDefault(); e.stopPropagation(); openExternal(item.url!); }}
                                            className="prep-item-link"
                                        >
                                            {item.label}
                                        </a>
                                    ) : item.label}
                                </span>
                                {/* Remove button for custom items */}
                                {idx >= PREP_CHECKLIST.length && (
                                    <button
                                        className="prep-item-remove-btn"
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
                        <div className="prep-custom-container">
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
                                className="prep-custom-input"
                            />
                            <button
                                className="btn btn-secondary prep-custom-btn"
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

                <div className={`timer-display ${paused ? 'paused' : 'running'}`}>
                    {formatSecondsMMSS(remaining)}
                </div>

                <div className="session-controls">
                    <button
                        className={`btn pause-resume-btn ${paused ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setPaused(!paused)}
                    >
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleBlockComplete()}>
                        Skip Block
                    </button>
                    <button
                        className="btn end-session-btn"
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
            <div className="timeline-container">
                {session.draft.map((b: any, i: number) => {
                    const isActive = i === session.nowBlockIdx;
                    const isDone = i < session.nowBlockIdx;
                    let blockClass = 'pending';
                    if (isActive) blockClass = 'active';
                    else if (isDone) blockClass = 'done';

                    return (
                        <div
                            key={i}
                            title={`${b.type} - ${b.minutes}m`}
                            className={`timeline-block ${blockClass}`}
                        />
                    );
                })}
            </div>

            {/* End Session Confirmation Modal */}
            {endConfirmStep !== 'none' && (
                <div className="modal-overlay" onClick={() => { setEndConfirmStep('none'); setPaused(false); }}>
                    <div className="modal-content confirm-modal-content" onClick={e => e.stopPropagation()}>
                        {endConfirmStep === 'confirm-stop' && (
                            <>
                                <h2 className="confirm-modal-title">⏸️ Stop studying?</h2>
                                <p className="confirm-modal-text">
                                    Are you sure you want to end this session early?
                                </p>
                                <div className="confirm-modal-actions">
                                    <button className="btn btn-primary" onClick={() => { setEndConfirmStep('none'); setPaused(false); }}>
                                        Keep studying
                                    </button>
                                    <button className="btn btn-secondary confirm-btn-danger" onClick={() => setEndConfirmStep('confirm-save')}>
                                        Yes, stop
                                    </button>
                                </div>
                            </>
                        )}

                        {endConfirmStep === 'confirm-save' && (
                            <>
                                <h2 className="confirm-modal-title">💾 Save your progress?</h2>
                                <p className="confirm-modal-text">
                                    Do you want to record the time you studied so far during this session?
                                </p>
                                <div className="confirm-modal-actions">
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
                            <div className="total-rest-container">
                                <h2 className="total-rest-title">🛑 TOTAL REST!</h2>
                                <p className="total-rest-subtitle">
                                    Session Complete.
                                </p>

                                <img
                                    src="/assets/images/learning center/01_mascot-diffuse-mode.png"
                                    alt="Diffuse mode rest"
                                    className="total-rest-img"
                                />

                                <p className="total-rest-desc">
                                    Recommendation: Lie down for 10 minutes.<br />
                                    Do absolutely NOTHING right now. No phone, no scrolling, no planning.<br /><br />
                                    Let your mind process what you just learned.
                                </p>

                                {/* Countdown */}
                                <div className={`total-rest-countdown ${restCountdown === 0 ? 'done' : 'running'}`}>
                                    {String(Math.floor(restCountdown / 60)).padStart(2, '0')}:{String(restCountdown % 60).padStart(2, '0')}
                                </div>

                                <div className="total-rest-actions">
                                    <button className="btn btn-primary btn-holographic total-rest-btn" onClick={() => finishSession(true, true)}>
                                        {restCountdown === 0 ? '✓ I am rested. Close session.' : 'Skip rest & close'}
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
