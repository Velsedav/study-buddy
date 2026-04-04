import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Sparkles, RotateCcw, Trophy, Lock, GraduationCap, Eye, EyeOff, PlusCircle } from 'lucide-react';
import { playSFX, SFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { curriculum } from '../lib/learningContent';
import type { Section, QuizOption } from '../lib/learningContent';
import { isDevMode, isDevNavUnlocked } from '../lib/devMode';
import { useTranslation } from '../lib/i18n';
import './Learning.css';

// ── Spaced Repetition Types & Constants ──

interface SRSEntry {
    level: number;
    lastCompleted: string;
    nextReviewAt: string;
    lockedUntil?: string;
}

type SRSState = Record<string, SRSEntry>;

const SRS_INTERVALS_DAYS = [7, 14, 30, 90];
const MAX_SRS_LEVEL = SRS_INTERVALS_DAYS.length;

function getIntervalDays(level: number): number {
    if (level <= 0) return 0;
    return SRS_INTERVALS_DAYS[Math.min(level - 1, SRS_INTERVALS_DAYS.length - 1)];
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function getNextDayStart(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getSectionQuestionIds(section: Section): number[] {
    return section.chapters.flatMap(ch => ch.lessons.map(l => l.question.id));
}

function isSectionPerfect(section: Section, quizState: Record<number, Record<string, boolean>>): boolean {
    const qIds = getSectionQuestionIds(section);
    return qIds.every(qId => {
        const answers = quizState[qId];
        if (!answers) return false;
        return Object.values(answers).some(v => v === true);
    });
}

function sectionHasWrongAnswer(section: Section, quizState: Record<number, Record<string, boolean>>): boolean {
    const qIds = getSectionQuestionIds(section);
    return qIds.some(qId => {
        const answers = quizState[qId];
        if (!answers) return false;
        return Object.values(answers).some(v => v === false);
    });
}

function isSectionDue(srsEntry: SRSEntry | undefined): boolean {
    if (!srsEntry || srsEntry.level === 0) return false;
    return new Date().getTime() >= new Date(srsEntry.nextReviewAt).getTime();
}

function isSectionLocked(srsEntry: SRSEntry | undefined): boolean {
    if (isDevMode()) return false;
    if (!srsEntry?.lockedUntil) return false;
    return new Date().getTime() < new Date(srsEntry.lockedUntil).getTime();
}

function getTimeUntil(isoDateStr: string): string {
    const now = new Date().getTime();
    const target = new Date(isoDateStr).getTime();
    const diffMs = target - now;
    if (diffMs <= 0) return 'Now';
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1 && diffDays < 14) return '1 week';
    if (diffDays < 30) return `${diffWeeks}w ${diffDays % 7}d`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '~1 month';
    return `~${diffMonths} months`;
}

function getLevelLabel(level: number): string {
    switch (level) {
        case 1: return 'Level 1 · 1 week';
        case 2: return 'Level 2 · 2 weeks';
        case 3: return 'Level 3 · 1 month';
        case 4: return 'Level 4 · 3 months';
        default: return 'New';
    }
}

function isSectionGraduated(srsEntry: SRSEntry | undefined): boolean {
    return (srsEntry?.level ?? 0) >= MAX_SRS_LEVEL;
}

// ── localStorage helpers ──

function loadQuizState(): Record<number, Record<string, boolean>> {
    try {
        const saved = localStorage.getItem('study-buddy-quiz-state');
        if (saved) return JSON.parse(saved);
    } catch { }
    return {};
}

function loadSRSState(): SRSState {
    try {
        const saved = localStorage.getItem('study-buddy-srs-state');
        if (saved) return JSON.parse(saved);
    } catch { }
    return {};
}

// ── Observation Journal Types & Helpers ──

interface LessonObservation {
    date: string; // ISO
    noticed: boolean | null; // true = noticed, false = not noticed, null = just journaled
    note: string;
}

type ObservationsState = Record<string, LessonObservation[]>; // keyed by lessonId

function loadObservationsState(): ObservationsState {
    try {
        const saved = localStorage.getItem('study-buddy-observations');
        if (saved) return JSON.parse(saved);
    } catch { }
    return {};
}

// ── Giant Sailor Moon Celebration ──

function CelebrationOverlay({ onDone }: { onDone: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showText, setShowText] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Massive particle setup
        const particles: {
            x: number; y: number; vx: number; vy: number;
            size: number; color: string; rotation: number; rotSpeed: number;
            life: number; maxLife: number; shape: 'circle' | 'rect' | 'star' | 'heart' | 'sparkle';
            trail: { x: number; y: number; alpha: number }[];
        }[] = [];

        const colors = [
            '#FFD700', '#FF69B4', '#FF1493', '#FF6B6B', '#4ECDC4',
            '#45B7D1', '#96CEB4', '#FF9F1C', '#E8A1E8', '#89CFF0',
            '#F0E68C', '#DDA0DD', '#FF7F50', '#98FB98', '#ADD8E6',
            '#FFB6C1', '#FFA07A', '#87CEEB', '#DA70D6', '#FFDAB9',
        ];

        // Wave 1: Massive center burst
        for (let i = 0; i < 200; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 4 + Math.random() * 14;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 6,
                size: 5 + Math.random() * 14,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 15,
                life: 0,
                maxLife: 100 + Math.random() * 100,
                shape: (['circle', 'rect', 'star', 'heart', 'sparkle'] as const)[Math.floor(Math.random() * 5)],
                trail: [],
            });
        }

        // Wave 2: Side fountains
        for (let i = 0; i < 80; i++) {
            const side = i % 2 === 0 ? 0 : canvas.width;
            const angle = side === 0 ? (-Math.PI / 4 + Math.random() * Math.PI / 2) : (Math.PI / 2 + Math.PI / 4 + Math.random() * Math.PI / 2);
            const speed = 6 + Math.random() * 10;
            particles.push({
                x: side, y: canvas.height * 0.7,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 8,
                size: 4 + Math.random() * 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 12,
                life: -Math.random() * 20,
                maxLife: 80 + Math.random() * 60,
                shape: (['circle', 'star', 'heart', 'sparkle'] as const)[Math.floor(Math.random() * 4)],
                trail: [],
            });
        }

        // Wave 3: Top rain
        for (let i = 0; i < 100; i++) {
            particles.push({
                x: Math.random() * canvas.width, y: -20 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 3,
                vy: 2 + Math.random() * 5,
                size: 3 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                life: -10 - Math.random() * 40,
                maxLife: 120 + Math.random() * 60,
                shape: (['circle', 'rect', 'sparkle'] as const)[Math.floor(Math.random() * 3)],
                trail: [],
            });
        }

        let frame = 0;
        const maxFrame = 220;

        // Show celebration text after a short delay
        setTimeout(() => setShowText(true), 300);

        const drawHeart = (ctx: CanvasRenderingContext2D, size: number) => {
            const s = size * 0.5;
            ctx.beginPath();
            ctx.moveTo(0, s * 0.4);
            ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.5, -s, 0, -s * 0.6);
            ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.4, 0, s * 0.4);
            ctx.fill();
        };

        const drawSparkle = (ctx: CanvasRenderingContext2D, size: number) => {
            const s = size * 0.5;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
                ctx.lineTo(Math.cos(angle + Math.PI / 4) * s * 0.3, Math.sin(angle + Math.PI / 4) * s * 0.3);
            }
            ctx.closePath();
            ctx.fill();
        };

        const drawStar = (ctx: CanvasRenderingContext2D, size: number) => {
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const a = (j * 4 * Math.PI) / 5 - Math.PI / 2;
                ctx.lineTo(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.5);
                const a2 = a + (2 * Math.PI) / 10;
                ctx.lineTo(Math.cos(a2) * size * 0.2, Math.sin(a2) * size * 0.2);
            }
            ctx.closePath();
            ctx.fill();
        };

        const animate = () => {
            frame++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Radial glow background pulse
            if (frame < 60) {
                const glowAlpha = Math.sin((frame / 60) * Math.PI) * 0.15;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.6);
                gradient.addColorStop(0, `rgba(255, 215, 0, ${glowAlpha})`);
                gradient.addColorStop(0.5, `rgba(255, 105, 180, ${glowAlpha * 0.5})`);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            for (const p of particles) {
                if (p.life < 0) { p.life++; continue; }
                p.life++;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.vx *= 0.995;
                p.rotation += p.rotSpeed;

                // Trail
                if (p.life % 2 === 0 && p.trail.length < 6) {
                    p.trail.push({ x: p.x, y: p.y, alpha: 0.4 });
                }
                for (let t = p.trail.length - 1; t >= 0; t--) {
                    p.trail[t].alpha -= 0.06;
                    if (p.trail[t].alpha <= 0) p.trail.splice(t, 1);
                }

                const alpha = Math.max(0, 1 - p.life / p.maxLife);
                if (alpha <= 0) continue;

                // Draw trail
                for (const t of p.trail) {
                    ctx.save();
                    ctx.globalAlpha = t.alpha * alpha;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, p.size * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Draw particle
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;

                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                } else if (p.shape === 'star') {
                    drawStar(ctx, p.size);
                } else if (p.shape === 'heart') {
                    drawHeart(ctx, p.size);
                } else {
                    drawSparkle(ctx, p.size);
                }

                // Glow effect
                ctx.shadowBlur = 8;
                ctx.shadowColor = p.color;
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.restore();
            }

            if (frame < maxFrame) {
                requestAnimationFrame(animate);
            } else {
                setShowText(false);
                setTimeout(onDone, 500);
            }
        };

        animate();
    }, [onDone]);

    return (
        <>
            <canvas ref={canvasRef} className="celebration-canvas" />
            {showText && (
                <div className="celebration-text">
                    <div className="celebration-text-inner">
                        ✨ Perfect Score! ✨
                    </div>
                </div>
            )}
        </>
    );
}

// ── Observation Panel ──

function ObservationPanel({ lessonId: _lessonId, observations, onAdd, t, theme }: {
    lessonId: string;
    observations: LessonObservation[];
    onAdd: (obs: LessonObservation) => void;
    t: (key: string) => string;
    theme: string;
}) {
    const [open, setOpen] = useState(false);
    const [noticed, setNoticed] = useState<boolean | null>(null);
    const [note, setNote] = useState('');

    function submit() {
        if (!note.trim() && noticed === null) return;
        onAdd({ date: new Date().toISOString(), noticed, note: note.trim() });
        setNote('');
        setNoticed(null);
        setOpen(false);
        playSFX(SFX.CHECK, theme);
    }

    return (
        <div className="observation-panel">
            {observations.length === 0 ? (
                <div className="observation-prompt">
                    <Eye size={14} />
                    <span>{t('learning.observe_prompt')}</span>
                </div>
            ) : (
                <div className="observation-log">
                    {observations.map((obs, i) => (
                        <div key={i} className="observation-entry">
                            <span className={`observation-noticed-badge${obs.noticed === true ? ' yes' : obs.noticed === false ? ' no' : ' neutral'}`}>
                                {obs.noticed === true ? t('learning.noticed_yes') : obs.noticed === false ? t('learning.noticed_no') : '·'}
                            </span>
                            <span className="observation-date">{new Date(obs.date).toLocaleDateString()}</span>
                            {obs.note && <span className="observation-note">{obs.note}</span>}
                        </div>
                    ))}
                </div>
            )}
            {!open ? (
                <button className="btn-text observation-add-btn" onClick={() => setOpen(true)}>
                    <PlusCircle size={13} />
                    {t('learning.add_observation')}
                </button>
            ) : (
                <div className="observation-form">
                    <div className="observation-form-noticed">
                        <span className="observation-form-label">{t('learning.noticed_question')}</span>
                        <div className="observation-noticed-btns">
                            <button className={`btn-noticed${noticed === true ? ' active-yes' : ''}`} onClick={() => setNoticed(noticed === true ? null : true)}>
                                <Eye size={12} /> {t('learning.noticed_yes')}
                            </button>
                            <button className={`btn-noticed${noticed === false ? ' active-no' : ''}`} onClick={() => setNoticed(noticed === false ? null : false)}>
                                <EyeOff size={12} /> {t('learning.noticed_no')}
                            </button>
                        </div>
                    </div>
                    <textarea
                        className="observation-textarea"
                        placeholder={t('learning.observation_placeholder')}
                        value={note}
                        rows={2}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                    />
                    <div className="observation-form-actions">
                        <button className="btn btn-secondary" onClick={() => setOpen(false)}>{t('learning.observation_cancel')}</button>
                        <button className="btn btn-primary" onClick={submit} disabled={!note.trim() && noticed === null}>{t('learning.observation_save')}</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Component ──

export default function LearningTab() {
    const { theme, isTerminal } = useSettings();
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [animating, setAnimating] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const [activeLessonIdx, setActiveLessonIdx] = useState(0);
    const [carouselHeight, setCarouselHeight] = useState(640);
    const activePanelRef = useRef<HTMLDivElement>(null);

    const [quizState, setQuizState] = useState<Record<number, Record<string, boolean>>>(loadQuizState);
    const [srsState, setSRSState] = useState<SRSState>(loadSRSState);
    const [observationsState, setObservationsState] = useState<ObservationsState>(loadObservationsState);
    const { t } = useTranslation();

    // Flat lesson list with chapter context — recomputes whenever selectedSection changes
    const flatLessons = selectedSection
        ? selectedSection.chapters.flatMap(ch => ch.lessons.map(l => ({ lesson: l, chapterTitle: ch.title })))
        : [];
    const currentLessonId = flatLessons[activeLessonIdx]?.lesson.id ?? null;

    function handleDevReset() {
        setSRSState({});
        setQuizState({});
    }

    useEffect(() => {
        localStorage.setItem('study-buddy-quiz-state', JSON.stringify(quizState));
    }, [quizState]);

    useEffect(() => {
        localStorage.setItem('study-buddy-srs-state', JSON.stringify(srsState));
    }, [srsState]);

    useEffect(() => {
        localStorage.setItem('study-buddy-observations', JSON.stringify(observationsState));
    }, [observationsState]);

    // On mount: clear quiz answers for due sections
    useEffect(() => {
        let quizCopy: Record<number, Record<string, boolean>> | null = null;
        for (const section of curriculum) {
            const entry = srsState[section.id];
            if (isSectionDue(entry)) {
                if (!quizCopy) quizCopy = { ...quizState };
                const qIds = getSectionQuestionIds(section);
                for (const qId of qIds) {
                    delete quizCopy[qId];
                }
            }
        }
        if (quizCopy) setQuizState(quizCopy);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearSectionQuiz = (section: Section) => {
        setQuizState(prev => {
            const next = { ...prev };
            for (const qId of getSectionQuestionIds(section)) delete next[qId];
            return next;
        });
    };

    const handleSectionClick = (section: Section) => {
        const entry = srsState[section.id];
        if (isSectionLocked(entry)) return;

        if (isDevMode()) {
            clearSectionQuiz(section);
        } else if (isSectionDue(entry) && entry?.lastCompleted) {
            // Only clear quiz if the section is due AND it was previously completed.
            // This ensures resuming a partially completed due section doesn't reset progress.
            const isPerfect = isSectionPerfect(section, quizState);
            if (isPerfect) clearSectionQuiz(section);
        }

        playSFX('glass_session_enter_lesson', theme);
        setAnimating(true);
        setTimeout(() => {
            setSelectedSection(section);
            setAnimating(false);
            window.scrollTo(0, 0);
        }, 300);
    };

    const handleBackClick = () => {
        // On exit: if the section has any wrong answers AND all questions have been attempted,
        // lock the section until the next day
        if (selectedSection) {
            const allAnswered = isSectionPerfect(selectedSection, quizState)
                || getSectionQuestionIds(selectedSection).every(qId => {
                    const answers = quizState[qId];
                    return answers && Object.keys(answers).length > 0;
                });
            const hasWrong = sectionHasWrongAnswer(selectedSection, quizState);
            const perfect = isSectionPerfect(selectedSection, quizState);

            if (allAnswered && hasWrong) {
                // Lock until tomorrow
                const lockUntil = getNextDayStart().toISOString();
                setSRSState(prev => ({
                    ...prev,
                    [selectedSection.id]: {
                        ...(prev[selectedSection.id] || { level: 0, lastCompleted: '', nextReviewAt: '' }),
                        lockedUntil: lockUntil,
                    }
                }));
            } else if (perfect && !hasWrong) {
                // Perfect and no wrong — update SRS (backup in case inline didn't fire)
                const entry = srsState[selectedSection.id];
                if (!entry || entry.lastCompleted === '') {
                    const currentLevel = entry?.level ?? 0;
                    const newLevel = Math.min(currentLevel + 1, MAX_SRS_LEVEL);
                    const intervalDays = getIntervalDays(newLevel);
                    const now = new Date();
                    setSRSState(prev => ({
                        ...prev,
                        [selectedSection.id]: {
                            level: newLevel,
                            lastCompleted: now.toISOString(),
                            nextReviewAt: addDays(now, intervalDays).toISOString(),
                        }
                    }));
                }
            }
        }

        playSFX('glass_ui_hover', theme);
        setAnimating(true);
        setTimeout(() => {
            setSelectedSection(null);
            setAnimating(false);
            window.scrollTo(0, 0);
        }, 300);
    };

    // Keep a ref to always call the latest handleBackClick from the popstate handler
    const handleBackClickRef = useRef(handleBackClick);
    useEffect(() => { handleBackClickRef.current = handleBackClick; });

    // Reset carousel index when entering a new section
    useEffect(() => {
        setActiveLessonIdx(0);
    }, [selectedSection?.id]);

    // Sync carousel height with active panel via ResizeObserver
    useEffect(() => {
        const panel = activePanelRef.current;
        if (!panel) return;
        setCarouselHeight(panel.offsetHeight);
        const obs = new ResizeObserver(([entry]) => {
            setCarouselHeight(Math.ceil(entry.contentRect.height));
        });
        obs.observe(panel);
        return () => obs.disconnect();
    }, [activeLessonIdx, selectedSection?.id]);

    // Keyboard arrow-key navigation within the carousel
    useEffect(() => {
        if (!selectedSection) return;
        const total = selectedSection.chapters.reduce((n, ch) => n + ch.lessons.length, 0);
        const handler = (e: KeyboardEvent) => {
            // Don't intercept when a button/input has keyboard focus
            const t = e.target as HTMLElement;
            if (t instanceof HTMLButtonElement || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
            if (e.key === 'ArrowLeft')  setActiveLessonIdx(prev => Math.max(0, prev - 1));
            else if (e.key === 'ArrowRight') setActiveLessonIdx(prev => Math.min(total - 1, prev + 1));
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedSection]); // eslint-disable-line react-hooks/exhaustive-deps

    // Intercept mouse back button / browser back gesture while inside a lesson
    useEffect(() => {
        if (!selectedSection) return;
        window.history.pushState({ learningSection: true }, '');
        const handler = () => handleBackClickRef.current();
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [!!selectedSection]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOptionClick = (questionId: number, option: QuizOption) => {
        if (!selectedSection) return;
        const currentEntry = srsState[selectedSection.id];
        if (isSectionLocked(currentEntry)) return;

        const qState = quizState[questionId] || {};
        if (Object.values(qState).some(v => v === true)) return;
        if (Object.values(qState).some(v => v === false)) return;
        if (qState[option.id] !== undefined) return;

        const newQState = { ...qState, [option.id]: option.isCorrect };
        const newQuizState = { ...quizState, [questionId]: newQState };
        setQuizState(newQuizState);

        if (option.isCorrect) {
            playSFX('glass_ui_check', theme);
            // Check if this completes the section perfectly
            const perfect = isSectionPerfect(selectedSection, newQuizState);
            if (perfect) {
                const hasWrong = sectionHasWrongAnswer(selectedSection, newQuizState);

                if (!hasWrong) {
                    // 🎉 PERFECT SCORE
                    playSFX('glass_reward_perfect', theme);
                    setShowCelebration(true);

                    const entry = srsState[selectedSection.id];
                    const currentLevel = entry?.level ?? 0;
                    const newLevel = Math.min(currentLevel + 1, MAX_SRS_LEVEL);
                    const intervalDays = getIntervalDays(newLevel);
                    const now = new Date();
                    setSRSState(prev => ({
                        ...prev,
                        [selectedSection.id]: {
                            level: newLevel,
                            lastCompleted: now.toISOString(),
                            nextReviewAt: addDays(now, intervalDays).toISOString(),
                        }
                    }));
                }
                // If hasWrong: section is completed but imperfect
                // Lockout will happen when user exits via handleBackClick
            }
        } else {
            playSFX('glass_ui_cancel', theme);
            // DON'T lock immediately — just record the wrong answer.
            // The lockout happens on exit (handleBackClick).
        }

        // Auto-scroll to next unanswered question after 1s (only on correct answer)
        if (!option.isCorrect) return;
        setTimeout(() => {
            if (!selectedSection) return;
            const allLessons = selectedSection.chapters.flatMap(ch => ch.lessons);
            const currentIdx = allLessons.findIndex(l => l.question.id === questionId);
            const nextLesson = allLessons.slice(currentIdx + 1).find(l => {
                const qs = newQuizState[l.question.id] || {};
                return !Object.values(qs).some(v => v === true);
            });
            if (nextLesson) {
                const nextIdx = allLessons.findIndex(l => l.id === nextLesson.id);
                if (nextIdx >= 0) setActiveLessonIdx(nextIdx);
            }
        }, 1200);
    };

    // ── Lesson View ──

    if (selectedSection) {
        const entry = srsState[selectedSection.id];
        const sectionPerfect = isSectionPerfect(selectedSection, quizState);
        const hasWrong = sectionHasWrongAnswer(selectedSection, quizState);
        const locked = isSectionLocked(entry);
        const graduated = isSectionGraduated(entry);

        return (
            <>
                {enlargedImage && createPortal(
                    <div onClick={() => setEnlargedImage(null)} className="learning-lightbox">
                        <img src={enlargedImage} alt="Enlarged view" className="learning-lightbox-img" />
                    </div>,
                    document.body
                )}
                <div className={`learning-lesson-view ${animating ? 'fade-out' : 'fade-in'}`}>
                {showCelebration && (
                    <CelebrationOverlay onDone={() => setShowCelebration(false)} />
                )}

                <div className="learning-header">
                    <button className="btn-icon learning-header-btn" onClick={handleBackClick}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="learning-header-title-container">
                        <h2 className="learning-header-title">
                            <span className="learning-header-icon" style={{ background: selectedSection.color }}>
                                {isTerminal ? `[${String(curriculum.findIndex(s => s.id === selectedSection.id) + 1).padStart(2, '0')}]` : selectedSection.icon}
                            </span>
                            {selectedSection.title}
                        </h2>
                        <p className="learning-header-desc">{selectedSection.description}</p>
                    </div>
                    {entry && entry.level > 0 && (
                        <div className={`srs-level-indicator ${graduated ? 'graduated' : ''}`}>
                            {graduated ? <GraduationCap size={14} /> : <Trophy size={14} />}
                            {graduated ? 'Graduated!' : getLevelLabel(entry.level)}
                        </div>
                    )}
                </div>

                {locked && (
                    <div className="section-locked-banner">
                        <Lock size={20} />
                        <div>
                            <strong>Section Locked</strong>
                            <span> A wrong answer was given. Try again {entry?.lockedUntil ? `in ${getTimeUntil(entry.lockedUntil)}` : 'tomorrow'}.</span>
                        </div>
                    </div>
                )}

                {sectionPerfect && !hasWrong && (
                    <div className="section-complete-banner slide-up">
                        {graduated ? <GraduationCap size={20} /> : <Trophy size={20} />}
                        <div>
                            <strong>{graduated ? '🎓 Section Graduated!' : '✨ Perfect Score!'}</strong>
                            {entry && entry.level > 0 && (
                                <span> Next review in {getTimeUntil(entry.nextReviewAt)}</span>
                            )}
                        </div>
                    </div>
                )}

                {sectionPerfect && hasWrong && (
                    <div className="section-imperfect-banner slide-up">
                        <RotateCcw size={20} />
                        <div>
                            <strong>Section Complete — but not perfect.</strong>
                            <span> You had wrong answers. The section will be locked until tomorrow when you go back.</span>
                        </div>
                    </div>
                )}

                <div className="lesson-view-layout">
                <nav className="lesson-nav">
                    {selectedSection.chapters.map(chapter => (
                        <div key={chapter.id} className="lesson-nav-chapter">
                            <div className="lesson-nav-chapter-title">{chapter.title}</div>
                            {chapter.lessons.map(lesson => {
                                const qs = quizState[lesson.question.id] || {};
                                const navSolved = Object.values(qs).some(v => v === true);
                                const navWrong = !navSolved && Object.values(qs).some(v => v === false);
                                const statusClass = navSolved ? 'correct' : navWrong ? 'wrong' : 'unanswered';
                                return (
                                    <button
                                        key={lesson.id}
                                        className={`lesson-nav-item status-${statusClass}${currentLessonId === lesson.id ? ' active' : ''}`}
                                        onClick={() => {
                                            playSFX('glass_ui_hover', theme);
                                            const idx = flatLessons.findIndex(({ lesson: l }) => l.id === lesson.id);
                                            if (idx >= 0) setActiveLessonIdx(idx);
                                        }}
                                    >
                                        <span className="lesson-nav-item-dot" />
                                        <span className="lesson-nav-item-title">{lesson.title}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* ── Horizontal Carousel ── */}
                <div className="lesson-carousel-wrapper">
                    <div
                        className="lesson-carousel-viewport"
                        style={{ '--carousel-height': `${carouselHeight}px` } as React.CSSProperties}
                    >
                        {flatLessons.map(({ lesson, chapterTitle }, idx) => {
                            const diff = idx - activeLessonIdx;
                            let panelClass = 'lesson-panel';
                            if (diff === 0)       panelClass += ' panel-active';
                            else if (diff === -1) panelClass += ' panel-prev';
                            else if (diff === 1)  panelClass += ' panel-next';
                            else if (diff < 0)    panelClass += ' panel-hidden-left';
                            else                  panelClass += ' panel-hidden-right';

                            const qState = quizState[lesson.question.id] || {};
                            const isSolved = Object.values(qState).some(v => v === true);
                            const isActive = diff === 0;

                            return (
                                <div
                                    key={lesson.id}
                                    ref={isActive ? activePanelRef : undefined}
                                    className={panelClass}
                                    onClick={!isActive ? () => setActiveLessonIdx(idx) : undefined}
                                    aria-hidden={!isActive}
                                >
                                    {(() => {
                                        // Compute image column content (null = no image for this lesson)
                                        let imageCol: React.ReactNode = null;
                                        if (lesson.id === 'lesson-1-1-a') {
                                            imageCol = (
                                                <div className="lesson-mascot-container">
                                                    <img src="/assets/images/learning center/01_mascot-sleep.png" alt="The mascot sleeping — memory consolidation happens during sleep" onClick={() => setEnlargedImage('/assets/images/learning center/01_mascot-sleep.png')} className="lesson-mascot-img" />
                                                    <p className="lesson-mascot-caption">Sleep is when your brain consolidates memories and grows new neural connections. <span className="lesson-mascot-caption-action">(Click to enlarge)</span></p>
                                                </div>
                                            );
                                        } else if (lesson.id === 'lesson-1-1-b') {
                                            imageCol = (
                                                <div className="lesson-mascot-container">
                                                    <img src="/assets/images/learning center/01_mascot-brainfertilizer.png" alt="The mascot after a workout — BDNF boosts brain connections" onClick={() => setEnlargedImage('/assets/images/learning center/01_mascot-brainfertilizer.png')} className="lesson-mascot-img" />
                                                    <p className="lesson-mascot-caption">Exercise releases BDNF — the brain's own fertilizer for growing stronger neural connections. <span className="lesson-mascot-caption-action">(Click to enlarge)</span></p>
                                                </div>
                                            );
                                        } else if (lesson.id === 'lesson-1-1-c') {
                                            imageCol = (
                                                <div className="lesson-mascot-container">
                                                    <img src="/assets/images/learning center/01_mascot-brain-fuel.png" alt="The mascot fueling up — proper nutrition powers the brain" onClick={() => setEnlargedImage('/assets/images/learning center/01_mascot-brain-fuel.png')} className="lesson-mascot-img" />
                                                    <p className="lesson-mascot-caption">Your brain runs on quality fuel — complex carbs, Omega-3s, and antioxidants sustain focus; sugar spikes crash it. <span className="lesson-mascot-caption-action">(Click to enlarge)</span></p>
                                                </div>
                                            );
                                        } else if (lesson.id === 'lesson-1-2-a') {
                                            imageCol = (
                                                <div className="lesson-mascot-container">
                                                    <img src="/assets/images/learning center/01_mascot-the-illusion-of-laziness.png" alt="The mascot exhausted in the evening — it's biology, not laziness" onClick={() => setEnlargedImage('/assets/images/learning center/01_mascot-the-illusion-of-laziness.png')} className="lesson-mascot-img" />
                                                    <p className="lesson-mascot-caption">Evening brain fog isn't laziness — your prefrontal cortex has simply run out of energy for the day. <span className="lesson-mascot-caption-action">(Click to enlarge)</span></p>
                                                </div>
                                            );
                                        } else if (lesson.id === 'lesson-1-2-c') {
                                            imageCol = (
                                                <div className="lesson-modes-grid">
                                                    {[
                                                        { src: '/assets/images/learning center/01_mascot_focused-mode.png', label: 'Focused Mode — tight, directed thinking along known neural paths.' },
                                                        { src: '/assets/images/learning center/01_mascot-diffuse-mode.png', label: 'Diffuse Mode — relaxed, wandering thought that makes unexpected connections.' },
                                                    ].map(img => (
                                                        <div key={img.src} className="lesson-modes-item">
                                                            <img src={img.src} alt={img.label} onClick={() => setEnlargedImage(img.src)} className="lesson-mascot-img full-width" />
                                                            <p className="lesson-mascot-caption small">{img.label} <span className="lesson-mascot-caption-action">(Click to enlarge)</span></p>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        } else if (lesson.id === 'lesson-2-2-a') {
                                            imageCol = (
                                                <div className="lesson-mascot-container">
                                                    <img src="/assets/images/learning center/spaced_repetition.png" alt="The Forgetting Curve & Spaced Repetition" onClick={() => setEnlargedImage('/assets/images/learning center/spaced_repetition.png')} className="lesson-mascot-img full-width" />
                                                    <p className="lesson-mascot-caption">The Forgetting Curve shows how memory decays without review. Spaced repetition resets the curve each time. <span className="lesson-mascot-caption-action">(Click to enlarge)</span></p>
                                                </div>
                                            );
                                        }

                                        const quizCol = (
                                            <div className="lesson-card-quiz-col">
                                                <div className="concept-check-container">
                                                    <h5 className="concept-check-header">
                                                        <Sparkles size={18} /> Concept Check
                                                    </h5>
                                                    <p className="concept-check-question">{lesson.question.question}</p>
                                                    <div className="concept-check-options">
                                                        {lesson.question.options.map(opt => {
                                                            const clickedStatus = qState[opt.id];
                                                            let optClass = 'quiz-option';
                                                            if (clickedStatus === true) optClass += ' correct revealed';
                                                            else if (clickedStatus === false) optClass += ' incorrect revealed';
                                                            else if (isSolved) optClass += ' disabled';
                                                            if (locked && clickedStatus === undefined) optClass += ' disabled';
                                                            return (
                                                                <div
                                                                    key={opt.id}
                                                                    className={optClass}
                                                                    onMouseEnter={() => { if (!isSolved && !locked) playSFX(SFX.HOVER, theme); }}
                                                                    onClick={() => handleOptionClick(lesson.question.id, opt)}
                                                                >
                                                                    <span>{opt.text}</span>
                                                                    {clickedStatus === true && <CheckCircle2 size={24} className="quiz-icon-correct" />}
                                                                    {clickedStatus === false && <XCircle size={24} className="quiz-icon-incorrect" />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {isSolved && (
                                                        <div className="quiz-success-msg slide-up">
                                                            <strong>{t('learning.correct')}</strong> {t('learning.correct_desc')}
                                                        </div>
                                                    )}
                                                    {isSolved && (
                                                        <ObservationPanel
                                                            lessonId={lesson.id}
                                                            observations={observationsState[lesson.id] ?? []}
                                                            onAdd={(obs) => {
                                                                setObservationsState(prev => ({
                                                                    ...prev,
                                                                    [lesson.id]: [...(prev[lesson.id] ?? []), obs]
                                                                }));
                                                            }}
                                                            t={t}
                                                            theme={theme}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );

                                        return (
                                            <div className={`glass lesson-card ${locked ? 'locked-section' : ''} ${isSolved ? 'solved' : ''}`}>
                                                <div className={`lesson-card-columns${imageCol ? ' has-image' : ''}`}>
                                                    {imageCol ? (
                                                        <>
                                                            <div className="lesson-card-left-col">
                                                                <div className="lesson-card-content"
                                                                    style={{ '--chapter-color': selectedSection.color } as React.CSSProperties}
                                                                >
                                                                    <div className="lesson-panel-chapter-label">{chapterTitle}</div>
                                                                    <h4 className="lesson-card-title">
                                                                        {lesson.title}
                                                                        {isSolved && <CheckCircle2 size={20} className="lesson-card-title-icon" />}
                                                                    </h4>
                                                                    <div className="lesson-card-body">
                                                                        <p className="lesson-card-desc">{lesson.content}</p>
                                                                    </div>
                                                                </div>
                                                                {quizCol}
                                                            </div>
                                                            <div className="lesson-card-image-col">
                                                                {imageCol}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="lesson-card-content"
                                                                style={{ '--chapter-color': selectedSection.color } as React.CSSProperties}
                                                            >
                                                                <div className="lesson-panel-chapter-label">{chapterTitle}</div>
                                                                <h4 className="lesson-card-title">
                                                                    {lesson.title}
                                                                    {isSolved && <CheckCircle2 size={20} className="lesson-card-title-icon" />}
                                                                </h4>
                                                                <div className="lesson-card-body">
                                                                    <p className="lesson-card-desc">{lesson.content}</p>
                                                                </div>
                                                            </div>
                                                            {quizCol}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>

                    <div className="lesson-carousel-nav">
                        <button
                            className="btn-icon lesson-carousel-btn"
                            onClick={() => { playSFX('glass_ui_hover', theme); setActiveLessonIdx(prev => Math.max(0, prev - 1)); }}
                            disabled={activeLessonIdx === 0}
                            aria-label="Previous lesson"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="lesson-progress-dots" role="tablist" aria-label="Lesson progress">
                            {flatLessons.map(({ lesson }, dotIdx) => {
                                const qs = quizState[lesson.question.id] || {};
                                const dotSolved = Object.values(qs).some(v => v === true);
                                const dotWrong = !dotSolved && Object.values(qs).some(v => v === false);
                                let dotClass = 'lesson-progress-dot';
                                if (dotIdx === activeLessonIdx) dotClass += ' dot-active';
                                else if (dotSolved) dotClass += ' dot-solved';
                                else if (dotWrong) dotClass += ' dot-wrong';
                                return (
                                    <button
                                        key={lesson.id}
                                        className={dotClass}
                                        onClick={() => { playSFX('glass_ui_hover', theme); setActiveLessonIdx(dotIdx); }}
                                        aria-label={lesson.title}
                                        aria-selected={dotIdx === activeLessonIdx}
                                        role="tab"
                                    />
                                );
                            })}
                        </div>
                        <button
                            className="btn-icon lesson-carousel-btn"
                            onClick={() => { playSFX('glass_ui_hover', theme); setActiveLessonIdx(prev => Math.min(flatLessons.length - 1, prev + 1)); }}
                            disabled={activeLessonIdx === flatLessons.length - 1}
                            aria-label="Next lesson"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
                </div>
                </div>
            </>
        );
    }

    // ── Grid View ──

    return (
        <div className={`learning-page ${animating ? 'fade-out' : 'fade-in'}`}>
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-accent"><Sparkles size={20} /></div>
                    <h1>Learning Center</h1>
                </div>
            </div>
            <div className="learning-tab">
            <p className="learning-tab-desc">Master the science of learning to study smarter, not harder.</p>
            {isDevNavUnlocked() && (
                <button
                    className="btn btn-secondary"
                    style={{ marginTop: 8, fontSize: '0.8rem', background: '#ff444422', borderColor: '#ff4444', color: '#ff4444' }}
                    onClick={handleDevReset}
                >
                    🛠 DEV: Reset all lessons
                </button>
            )}

            <div className="learning-grid">
                {curriculum.map((section, idx) => {
                    const entry = srsState[section.id];
                    const due = isSectionDue(entry);
                    const locked = isSectionLocked(entry);
                    const hasLevel = entry && entry.level > 0;
                    const graduated = isSectionGraduated(entry);

                    let cardClass = 'glass learning-section-card';
                    if (due) cardClass += ' srs-due';
                    if (locked) cardClass += ' srs-locked';
                    if (graduated && !due) cardClass += ' srs-graduated';

                    return (
                        <div
                            key={section.id}
                            className={cardClass}
                            style={{ '--animation-order': idx } as any}
                            onClick={() => handleSectionClick(section)}
                            onMouseEnter={() => { if (!locked) playSFX('glass_ui_hover', theme); }}
                        >
                            <div className="section-icon-badge" style={{ background: locked ? 'var(--text-muted)' : section.color }}>
                                {locked ? <Lock size={20} /> : (isTerminal ? `[${String(idx + 1).padStart(2, '0')}]` : section.icon)}
                            </div>
                            <h3>{section.title}</h3>
                            <p className="learning-section-card-desc">{section.description}</p>

                            {locked && (
                                <div className="srs-badge locked">
                                    <Lock size={14} />
                                    Locked until {entry?.lockedUntil ? getTimeUntil(entry.lockedUntil) : 'tomorrow'}
                                </div>
                            )}
                            {!locked && due && (
                                <div className="srs-badge due">
                                    <RotateCcw size={14} />
                                    Due for review
                                </div>
                            )}
                            {!locked && !due && graduated && (
                                <div className="srs-badge graduated">
                                    <GraduationCap size={14} />
                                    Graduated
                                </div>
                            )}
                            {!locked && !due && hasLevel && !graduated && (
                                <div className="srs-badge mastered">
                                    <Trophy size={14} />
                                    Review in {getTimeUntil(entry.nextReviewAt)}
                                </div>
                            )}

                            <button
                                className={`btn learning-section-card-action ${locked ? 'btn-disabled' : 'btn-secondary'}`}
                                disabled={locked}
                            >
                                {locked ? 'Locked' : due ? 'Review Now' : graduated ? 'Review' : hasLevel ? 'Revisit' : 'Start Lesson'}
                            </button>
                        </div>
                    );
                })}
            </div>
            </div>
        </div>
    );
}
