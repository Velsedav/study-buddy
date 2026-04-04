import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Sparkles, Pencil, Lightbulb, BarChart2, Settings as SettingsIcon, Wrench, FlaskConical, Target, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getQuotes, addQuote, saveSession, updateSubjectStats } from '../lib/db';
import type { Quote } from '../lib/db';
import QuoteEditorModal from './QuoteEditorModal';
import { useTranslation } from '../lib/i18n';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject, incrementStudyCount } from '../lib/chapters';
import { isDevNavUnlocked, toggleDevNav } from '../lib/devMode';
import './Layout.css';

const MASCOT_DEFAULT_QUOTE = "The exam is won at home, not on exam day 🏠";
const DEV_NAV_CLICKS = 10;

interface PathEntry { path: string; status: 'saving' | 'ok' | 'error'; slot: 1 | 2; }


function CloseOverlay() {
    const { t } = useTranslation();
    const [phase, setPhase] = useState<'idle' | 'saving' | 'done'>('idle');
    const [paths, setPaths] = useState<PathEntry[]>([]);

    useEffect(() => {
        const onStart = () => { setPhase('saving'); setPaths([]); };
        const onDone = () => setPhase('done');
        const onPath = (e: Event) => {
            const { path, status, slot } = (e as CustomEvent<{ path: string; status: PathEntry['status']; slot: 1 | 2 }>).detail;
            setPaths(prev => {
                const idx = prev.findIndex(p => p.slot === slot);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { path, status, slot };
                    return next;
                }
                return [...prev, { path, status, slot }];
            });
        };
        window.addEventListener('app-close-start', onStart);
        window.addEventListener('app-close-done', onDone);
        window.addEventListener('app-close-path', onPath);
        return () => {
            window.removeEventListener('app-close-start', onStart);
            window.removeEventListener('app-close-done', onDone);
            window.removeEventListener('app-close-path', onPath);
        };
    }, []);

    if (phase === 'idle') return null;

    const isDone = phase === 'done';

    return (
        <div className="close-overlay">
            <div className="close-overlay-card">
                <div className="close-overlay-header">
                    {isDone
                        ? <CheckCircle2 size={28} className="close-overlay-check" />
                        : <Loader2 size={28} className="close-overlay-spinner" />
                    }
                    <p className="close-overlay-label">
                        {isDone ? t('app.save_done') : t('app.saving')}
                    </p>
                </div>

                {paths.length > 0 && (
                    <ul className="close-overlay-paths">
                        {paths.map(({ path, status, slot }) => (
                            <li key={slot} className={`close-overlay-path-row close-overlay-path-${status}`}>
                                <span className="close-overlay-path-label">
                                    {slot === 1 ? t('app.backup_primary') : t('app.backup_secondary')}
                                </span>
                                {status === 'saving' && <Loader2 size={13} className="close-overlay-path-spinner" />}
                                {status === 'ok' && <CheckCircle2 size={13} />}
                                {status === 'error' && <span title={path}><XCircle size={13} /></span>}
                            </li>
                        ))}
                    </ul>
                )}

                {!isDone && (
                    <button
                        className="btn btn-secondary close-overlay-force"
                        onClick={() => (window as any).__forceQuit?.()}
                    >
                        {t('app.force_quit')}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { theme, isTerminal } = useSettings();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [animClass, setAnimClass] = useState('quote-visible');
    const [editorOpen, setEditorOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [glitchVariant, setGlitchVariant] = useState<'a' | 'b' | 'c' | null>(null);
    const [navWarningStep, setNavWarningStep] = useState<'none' | 'confirm-stop' | 'confirm-save'>('none');
    const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
    const [devNavVisible, setDevNavVisible] = useState(isDevNavUnlocked);
    const [mascotClickCount, setMascotClickCount] = useState(0);
    const mascotClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [learningReviewDue, setLearningReviewDue] = useState(false);

    function handleMascotClick() {
        const next = mascotClickCount + 1;
        if (next >= DEV_NAV_CLICKS) {
            const visible = toggleDevNav();
            setDevNavVisible(visible);
            setMascotClickCount(0);
            if (mascotClickTimerRef.current) clearTimeout(mascotClickTimerRef.current);
        } else {
            setMascotClickCount(next);
            if (mascotClickTimerRef.current) clearTimeout(mascotClickTimerRef.current);
            mascotClickTimerRef.current = setTimeout(() => setMascotClickCount(0), 2000);
        }
    }

    const baseNavItems = [
        { path: '/', label: t('nav.subjects'), icon: BookOpen },
        { path: '/plan', label: t('nav.planner'), icon: Calendar },
        { path: '/learning', label: t('nav.learning'), icon: Lightbulb },
        { path: '/analytics', label: t('nav.analytics'), icon: BarChart2 },
        { path: '/bingoals', label: t('nav.bingoals'), icon: Target },
        { path: '/metacognition-logs', label: t('nav.metacognition_logs'), icon: Wrench },
        { path: '/settings', label: t('nav.settings'), icon: SettingsIcon },
    ];
    const navItems = devNavVisible
        ? [...baseNavItems, { path: '/dev', label: 'Dev', icon: FlaskConical }]
        : baseNavItems;

    useEffect(() => {
        const check = () => {
            try {
                const raw = localStorage.getItem('study-buddy-srs-state');
                if (!raw) return;
                const srs = JSON.parse(raw);
                const now = Date.now();
                const due = Object.values(srs).some((e: any) =>
                    e.level > 0 && !e.lockedUntil && new Date(e.nextReviewAt).getTime() <= now
                );
                setLearningReviewDue(due);
            } catch { /* ignore */ }
        };
        check();
        const id = setInterval(check, 60_000);
        return () => clearInterval(id);
    }, []);

    const loadQuotes = useCallback(async () => {
        try {
            const q = await getQuotes();
            // Seed the default mascot quote if not present
            const hasMascotQuote = q.some(quote => quote.text.includes("The exam is won at home"));
            if (!hasMascotQuote) {
                await addQuote(MASCOT_DEFAULT_QUOTE);
                const updated = await getQuotes();
                setQuotes(updated);
            } else {
                setQuotes(q);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => { loadQuotes(); }, [loadQuotes]);

    // Rotate quotes every 4.5s with anime-style bounce animation
    useEffect(() => {
        if (quotes.length <= 1) return;

        function cycle() {
            // Start exit animation
            setAnimClass('quote-exit');

            // After exit animation (300ms), switch quote and enter
            timeoutRef.current = setTimeout(() => {
                setCurrentIdx(prev => (prev + 1) % quotes.length);
                setAnimClass('quote-enter');

                // After enter animation completes, set to visible (idle)
                timeoutRef.current = setTimeout(() => {
                    setAnimClass('quote-visible');
                }, 500);
            }, 300);
        }

        const interval = setInterval(cycle, 4500);
        return () => {
            clearInterval(interval);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [quotes.length]);

    // Global Zoom via Ctrl+Wheel
    useEffect(() => {
        let currentZoom = parseFloat(localStorage.getItem('study-buddy-zoom') || '1.0');

        // Ensure starting zoom applies
        document.documentElement.style.fontSize = `${16 * currentZoom}px`;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                currentZoom = Math.min(Math.max(currentZoom + delta, 0.5), 2.0);

                document.documentElement.style.fontSize = `${16 * currentZoom}px`;
                localStorage.setItem('study-buddy-zoom', currentZoom.toString());
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const currentQuote = quotes.length > 0
        ? quotes[currentIdx % quotes.length]?.text
        : 'Let\'s do our best today! ✨';

    function handleNavClick(e: React.MouseEvent, path: string) {
        playSFX('glass_enter_menu', theme);
        if (isTerminal) {
            const variants = ['a', 'b', 'c'] as const;
            const picked = variants[Math.floor(Math.random() * variants.length)];
            if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
            setGlitchVariant(picked);
            glitchTimerRef.current = setTimeout(() => setGlitchVariant(null), 300);
        }
        if (localStorage.getItem('activeSession')) {
            e.preventDefault();
            setPendingNavPath(path);
            setNavWarningStep('confirm-stop');
        }
    }

    async function finishSessionFromLayout(saveProgress: boolean) {
        const stored = localStorage.getItem('activeSession');
        if (!stored) return;
        const session = JSON.parse(stored);

        if (saveProgress) {
            const endedAt = new Date().toISOString();
            const remaining = session.remainingSeconds || 0;

            let actualMins = 0;
            for (let i = 0; i <= session.nowBlockIdx; i++) {
                if (i < session.nowBlockIdx) {
                    actualMins += session.draft[i].minutes;
                } else {
                    actualMins += Math.floor((session.draft[i].minutes * 60 - remaining) / 60);
                }
            }

            const workBySubject: Record<string, number> = {};
            for (let i = 0; i <= session.nowBlockIdx; i++) {
                const block = session.draft[i];
                if (block.type === 'WORK' && block.subject_id) {
                    const mins = i < session.nowBlockIdx
                        ? block.minutes
                        : Math.floor((block.minutes * 60 - remaining) / 60);
                    if (mins > 0) {
                        workBySubject[block.subject_id] = (workBySubject[block.subject_id] || 0) + mins;
                    }
                }
            }

            await saveSession({
                id: session.sessionId,
                started_at: session.startedAt,
                ended_at: endedAt,
                template: session.template,
                repeats: session.repeats,
                planned_minutes: session.plannedMinutes,
                actual_minutes: actualMins
            }, session.draft);

            for (const [subjId, mins] of Object.entries(workBySubject)) {
                await updateSubjectStats(subjId, mins as number, endedAt);
            }

            const completedChapterIds = new Set<string>();
            for (let i = 0; i <= session.nowBlockIdx; i++) {
                const block = session.draft[i];
                if (block.type === 'WORK' && block.subject_id && block.chapter_name) {
                    const mins = i < session.nowBlockIdx
                        ? block.minutes
                        : Math.floor((block.minutes * 60 - remaining) / 60);
                    if (mins > 0) {
                        const chaps = getChaptersForSubject(block.subject_id);
                        const ch = chaps.find((c: any) => c.name === block.chapter_name);
                        if (ch) completedChapterIds.add(ch.id);
                    }
                }
            }
            for (const id of completedChapterIds) {
                incrementStudyCount(id);
            }
        }

        localStorage.removeItem('activeSession');
        setNavWarningStep('none');
        navigate(pendingNavPath || '/');
        setPendingNavPath(null);
    }

    // Terminal typing effect
    const [typedText, setTypedText] = useState('');
    const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isTerminal) return;
        if (typingRef.current) clearTimeout(typingRef.current);
        setTypedText('');

        let i = 0;
        const full = currentQuote;
        function typeNext() {
            i++;
            setTypedText(full.slice(0, i));
            if (i < full.length) {
                typingRef.current = setTimeout(typeNext, 12);
            }
        }
        typingRef.current = setTimeout(typeNext, 80);
        return () => { if (typingRef.current) clearTimeout(typingRef.current); };
    }, [currentQuote, isTerminal]);

    return (
        <div className="layout">
            {/* Sidebar Navigation */}
            <nav className="glass sidebar">
                <div className="logo">
                    {isTerminal ? (
                        <span className="logo-code-icon">{'</>'}</span>
                    ) : (
                        <Sparkles className="icon-gold" size={32} />
                    )}
                    <h2>Study Buddy</h2>
                </div>

                <ul className="nav-links">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`nav-link ${active ? 'active' : ''}`}
                                    aria-current={active ? 'page' : undefined}
                                    onMouseEnter={() => playSFX('glass_ui_hover', theme)}
                                    onClick={(e) => handleNavClick(e, item.path)}
                                >
                                    <Icon size={20} />
                                    <span>{item.label}</span>
                                    {item.path === '/learning' && learningReviewDue && (
                                        <span className="nav-review-dot" aria-label="Review available" />
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {isTerminal ? (
                    <div className="terminal-quote-container">
                        <div className="terminal-quote-line">
                            <span className="terminal-prompt">&gt; </span>
                            <span className="terminal-typed">{typedText}<span className="terminal-cursor">█</span></span>
                        </div>
                        <button
                            className="quote-edit-btn terminal-edit-btn"
                            onClick={() => setEditorOpen(true)}
                            title="Edit quotes"
                        >
                            <Pencil size={12} />
                        </button>
                    </div>
                ) : (
                    <div className="mascot-container">
                        <div className="mascot-bubble-wrapper">
                            <div className={`mascot-bubble ${animClass}`} key={currentIdx}>
                                {currentQuote}
                            </div>
                            <button
                                className="quote-edit-btn"
                                onClick={() => setEditorOpen(true)}
                                title="Edit quotes"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                        <img
                            src="/mascot.png"
                            alt="Study Buddy Mascot"
                            className="mascot-img"
                            onClick={handleMascotClick}
                        />
                    </div>
                )}
            </nav>

            {/* Main Content Area */}
            <main className={`main-content${glitchVariant ? ` terminal-glitch-${glitchVariant}` : ''}`}>
                <div className="top-decoration"></div>
                <div key={location.pathname} className="page-route-transition">
                    <Outlet />
                </div>
            </main>

            {editorOpen && (
                <QuoteEditorModal
                    onClose={() => setEditorOpen(false)}
                    onChanged={loadQuotes}
                />
            )}

            <CloseOverlay />

            {navWarningStep !== 'none' && (
                <div className="modal-overlay" onClick={() => { setNavWarningStep('none'); setPendingNavPath(null); }}>
                    <div className="modal-content confirm-modal-content" role="dialog" aria-modal="true" aria-labelledby="nav-confirm-title" onClick={e => e.stopPropagation()}>
                        {navWarningStep === 'confirm-stop' && (
                            <>
                                <h2 id="nav-confirm-title" className="confirm-modal-title">⏸️ Stop studying?</h2>
                                <p className="confirm-modal-text">
                                    Are you sure you want to end this session early?
                                </p>
                                <div className="confirm-modal-actions">
                                    <button className="btn btn-primary" onClick={() => { setNavWarningStep('none'); setPendingNavPath(null); }}>
                                        Keep studying
                                    </button>
                                    <button className="btn btn-secondary confirm-btn-danger" onClick={() => setNavWarningStep('confirm-save')}>
                                        Yes, stop
                                    </button>
                                </div>
                            </>
                        )}
                        {navWarningStep === 'confirm-save' && (
                            <>
                                <h2 className="confirm-modal-title">💾 Save your progress?</h2>
                                <p className="confirm-modal-text">
                                    Do you want to record the time you studied so far during this session?
                                </p>
                                <div className="confirm-modal-actions">
                                    <button className="btn btn-primary" onClick={() => finishSessionFromLayout(true)}>
                                        Save progress
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => finishSessionFromLayout(false)}>
                                        Discard
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
