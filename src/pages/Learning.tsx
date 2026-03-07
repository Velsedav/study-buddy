import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Sparkles, RotateCcw, Trophy, Lock, GraduationCap } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { curriculum } from '../lib/learningContent';
import type { Section, QuizOption } from '../lib/learningContent';

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

// ── Main Component ──

export default function LearningTab() {
    const { theme } = useSettings();
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [animating, setAnimating] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

    const [quizState, setQuizState] = useState<Record<number, Record<string, boolean>>>(loadQuizState);
    const [srsState, setSRSState] = useState<SRSState>(loadSRSState);

    useEffect(() => {
        localStorage.setItem('study-buddy-quiz-state', JSON.stringify(quizState));
    }, [quizState]);

    useEffect(() => {
        localStorage.setItem('study-buddy-srs-state', JSON.stringify(srsState));
    }, [srsState]);

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

        // Only clear quiz if the section is due AND it was previously completed.
        // This ensures resuming a partially completed due section doesn't reset progress.
        if (isSectionDue(entry) && entry?.lastCompleted) {
            const isPerfect = isSectionPerfect(section, quizState);
            if (isPerfect) clearSectionQuiz(section);
        }

        playSFX('entering_lesson', theme);
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

        playSFX('hover_sound', theme);
        setAnimating(true);
        setTimeout(() => {
            setSelectedSection(null);
            setAnimating(false);
            window.scrollTo(0, 0);
        }, 300);
    };

    const handleOptionClick = (questionId: number, option: QuizOption) => {
        if (!selectedSection) return;
        const currentEntry = srsState[selectedSection.id];
        if (isSectionLocked(currentEntry)) return;

        const qState = quizState[questionId] || {};
        if (Object.values(qState).some(v => v === true)) return;
        if (qState[option.id] !== undefined) return;

        const newQState = { ...qState, [option.id]: option.isCorrect };
        const newQuizState = { ...quizState, [questionId]: newQState };
        setQuizState(newQuizState);

        if (option.isCorrect) {
            playSFX('checklist_sound', theme);
            // Check if this completes the section perfectly
            const perfect = isSectionPerfect(selectedSection, newQuizState);
            if (perfect) {
                const hasWrong = sectionHasWrongAnswer(selectedSection, newQuizState);

                if (!hasWrong) {
                    // 🎉 PERFECT SCORE
                    playSFX('perfect_score', theme);
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
            playSFX('cancelling', theme);
            // DON'T lock immediately — just record the wrong answer.
            // The lockout happens on exit (handleBackClick).
        }
    };

    // ── Lesson View ──

    if (selectedSection) {
        const entry = srsState[selectedSection.id];
        const sectionPerfect = isSectionPerfect(selectedSection, quizState);
        const hasWrong = sectionHasWrongAnswer(selectedSection, quizState);
        const locked = isSectionLocked(entry);
        const graduated = isSectionGraduated(entry);

        return (
            <div className={`learning-lesson-view ${animating ? 'fade-out' : 'fade-in'}`}>
                {showCelebration && (
                    <CelebrationOverlay onDone={() => setShowCelebration(false)} />
                )}

                {/* Image lightbox overlay */}
                {enlargedImage && (
                    <div
                        onClick={() => setEnlargedImage(null)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9999,
                            background: 'rgba(0, 0, 0, 0.85)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'zoom-out',
                            animation: 'fadeIn 0.2s ease',
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        <img
                            src={enlargedImage}
                            alt="Enlarged view"
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '90vh',
                                borderRadius: '16px',
                                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                                animation: 'scaleIn 0.25s ease',
                            }}
                        />
                    </div>
                )}

                <div className="learning-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <button className="btn-icon" onClick={handleBackClick} style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.5rem', background: selectedSection.color, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', color: '#fff' }}>
                                {selectedSection.icon}
                            </span>
                            {selectedSection.title}
                        </h2>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>{selectedSection.description}</p>
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

                <div className="learning-content" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {selectedSection.chapters.map(chapter => (
                        <div key={chapter.id} className="chapter-container">
                            <h3 style={{ borderBottom: '2px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '16px', color: selectedSection.color }}>
                                {chapter.title}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {chapter.lessons.map(lesson => {
                                    const qState = quizState[lesson.question.id] || {};
                                    const isSolved = Object.values(qState).some(v => v === true);

                                    return (
                                        <div key={lesson.id} className={`glass lesson-card ${locked ? 'locked-section' : ''}`} style={{
                                            padding: '24px',
                                            borderRadius: '16px',
                                            border: isSolved ? '2px solid var(--success)' : undefined,
                                            background: isSolved ? 'linear-gradient(145deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))' : undefined,
                                            boxShadow: isSolved ? '0 4px 20px rgba(34, 197, 94, 0.05)' : undefined
                                        }}>
                                            <h4 style={{ marginBottom: '12px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {lesson.title}
                                                {isSolved && <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />}
                                            </h4>
                                            <p style={{ lineHeight: '1.6', color: 'var(--text-dark)', marginBottom: '24px' }}>
                                                {lesson.content}
                                            </p>

                                            {/* Forgetting Curve image for spaced repetition lesson */}
                                            {lesson.id === 'lesson-2-2-a' && (
                                                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                                    <img
                                                        src="/assets/images/learning center/spaced_repetition.png"
                                                        alt="The Forgetting Curve & Spaced Repetition"
                                                        onClick={() => setEnlargedImage('/assets/images/learning center/spaced_repetition.png')}
                                                        style={{
                                                            maxWidth: '100%',
                                                            borderRadius: '12px',
                                                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                                            cursor: 'zoom-in',
                                                            transition: 'transform 0.2s ease',
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                                                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                                                    />
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                                                        The Forgetting Curve shows how memory decays without review. Spaced repetition resets the curve each time. <span style={{ color: 'var(--primary)', fontWeight: 600 }}>(Click to enlarge)</span>
                                                    </p>
                                                </div>
                                            )}

                                            <div className="quiz-container" style={{ background: 'rgba(0,0,0,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                                <h5 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)', fontSize: '1rem' }}>
                                                    <Sparkles size={18} /> Concept Check
                                                </h5>
                                                <p style={{ fontWeight: 500, marginBottom: '16px' }}>{lesson.question.question}</p>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                                        <strong>Correct!</strong> Great job internalizing this concept!
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Grid View ──

    return (
        <div className={`learning-tab ${animating ? 'fade-out' : 'fade-in'}`}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Sparkles className="icon-gold" size={32} />
                    Learning Track
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Master the science of learning to study smarter, not harder.</p>
            </div>

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
                            onMouseEnter={() => { if (!locked) playSFX('hover_sound', theme); }}
                        >
                            <div className="section-icon-badge" style={{ background: locked ? 'var(--text-muted)' : section.color }}>
                                {locked ? <Lock size={20} /> : section.icon}
                            </div>
                            <h3>{section.title}</h3>
                            <p style={{ lineHeight: '1.5' }}>{section.description}</p>

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
                                className={`btn ${locked ? 'btn-disabled' : 'btn-secondary'}`}
                                style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                                disabled={locked}
                            >
                                {locked ? 'Locked' : due ? 'Review Now' : graduated ? 'Review' : hasLevel ? 'Revisit' : 'Start Lesson'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
