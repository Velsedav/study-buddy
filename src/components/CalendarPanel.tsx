import { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X, Flag, Trash2 } from 'lucide-react';
import type { Session, Subject, SessionBlock } from '../lib/db';
import type { Chapter } from '../lib/chapters';
import { useSettings } from '../lib/settings';
import { playSFX } from '../lib/sounds';

// ── Goal Dates ──
interface GoalDate {
    id: string;
    date: string;
    label: string;
}

const GOAL_DATES_KEY = 'study-buddy-goal-dates';

function loadGoalDates(): GoalDate[] {
    try {
        const saved = localStorage.getItem(GOAL_DATES_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return [];
}

function saveGoalDates(goals: GoalDate[]) {
    localStorage.setItem(GOAL_DATES_KEY, JSON.stringify(goals));
}

// ── Helpers ──
function toLocalDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getIntensityClass(mins: number) {
    if (mins === 0) return 'h-level-0';
    if (mins < 30) return 'h-level-1';
    if (mins < 60) return 'h-level-2';
    if (mins < 120) return 'h-level-3';
    return 'h-level-4';
}

// ── Props ──
interface CalendarPanelProps {
    sessions: Session[];
    blocks: SessionBlock[];
    subjects: Subject[];
    allChapters: Chapter[];
    /** If true, show the weekly active days for rainbow/flame logic. Pass weeklyActiveDays from parent. */
    weeklyActiveDays?: number;
}

export default function CalendarPanel({
    sessions,
    blocks,
    subjects,
    allChapters,
    weeklyActiveDays = 0,
}: CalendarPanelProps) {
    const { weekStart, theme } = useSettings();

    const [currentHeatmapMonth, setCurrentHeatmapMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);
    const [goalDates, setGoalDates] = useState<GoalDate[]>(loadGoalDates);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [newGoalDate, setNewGoalDate] = useState('');
    const [newGoalLabel, setNewGoalLabel] = useState('');

    const updateGoalDates = (next: GoalDate[]) => {
        setGoalDates(next);
        saveGoalDates(next);
    };

    const addGoalDate = () => {
        if (!newGoalDate || !newGoalLabel.trim()) return;
        updateGoalDates([...goalDates, { id: crypto.randomUUID(), date: newGoalDate, label: newGoalLabel.trim() }]);
        setNewGoalDate('');
        setNewGoalLabel('');
        setShowGoalModal(false);
    };

    const removeGoalDate = (id: string) => updateGoalDates(goalDates.filter(g => g.id !== id));

    // ── Heatmap ──
    const heatmapData = useMemo(() => {
        const year = currentHeatmapMonth.getFullYear();
        const month = currentHeatmapMonth.getMonth();
        const monthDays: Date[] = [];
        let itr = new Date(year, month, 1);
        const nextMonth = new Date(year, month + 1, 1);
        while (itr < nextMonth) {
            monthDays.push(new Date(itr));
            itr.setDate(itr.getDate() + 1);
        }

        return monthDays.map(date => {
            const dateStr = toLocalDateStr(date);
            const daySessions = sessions.filter(s => toLocalDateStr(new Date(s.started_at)) === dateStr);
            let dayMin = 0;
            daySessions.forEach(s => { if (s.actual_minutes) dayMin += s.actual_minutes; });
            let tooltip = date.toLocaleDateString();
            tooltip += dayMin > 0 ? ` - ${dayMin} minutes (${daySessions.length} sessions)` : ' - No sessions';
            return { date, mins: dayMin, tooltip, sessions: daySessions };
        });
    }, [sessions, currentHeatmapMonth]);

    const goalDateSet = useMemo(() => {
        const map: Record<string, GoalDate> = {};
        for (const g of goalDates) map[g.date] = g;
        return map;
    }, [goalDates]);

    // ── Day log data ──
    const sessionsForSelectedDate = useMemo(() => {
        if (!selectedLogDate) return [];
        const targetStr = toLocalDateStr(selectedLogDate);
        return (heatmapData.find(d => toLocalDateStr(d.date) === targetStr)?.sessions || [])
            .map((session: Session) => {
                const sessionBlocks = blocks.filter(b => b.session_id === session.id && b.subject_id);
                const subjectIds = [...new Set(sessionBlocks.map(b => b.subject_id).filter((id): id is string => !!id))];
                const subjectNames = subjectIds.map(id => subjects.find(s => s.id === id)?.name).filter(Boolean);
                return { ...session, subject_name: subjectNames.length > 0 ? subjectNames.join(', ') : 'Non spécifié' };
            });
    }, [selectedLogDate, heatmapData, blocks, subjects]);

    // ── Deadlines ──
    const allDeadlines = useMemo(() => [
        ...goalDates.map(g => ({ ...g, type: 'manual' as const, result: null })),
        ...subjects.filter(s => s.deadline).map(s => ({
            id: s.id, label: s.name, date: s.deadline!, type: 'subject' as const, result: s.result
        }))
    ], [goalDates, subjects]);

    const todayStr = toLocalDateStr(new Date());
    const upcoming = allDeadlines
        .filter(g => new Date(g.date + 'T00:00:00') >= new Date(todayStr + 'T00:00:00'))
        .sort((a, b) => a.date.localeCompare(b.date));
    const pastWithResults = allDeadlines
        .filter(g => g.result && new Date(g.date + 'T00:00:00') < new Date(todayStr + 'T00:00:00'))
        .sort((a, b) => b.date.localeCompare(a.date));

    // ── Prefix for calendar grid ──
    const firstDayOfMonthDate = new Date(currentHeatmapMonth.getFullYear(), currentHeatmapMonth.getMonth(), 1);
    const firstDayOfWeek = firstDayOfMonthDate.getDay();
    const emptyPrefixCount = weekStart === 'monday'
        ? (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)
        : firstDayOfWeek;

    return (
        <>
            {/* ── Day Log Modal ── */}
            {selectedLogDate && (
                <div className="modal-overlay" onClick={() => setSelectedLogDate(null)}>
                    <div className="modal-content modal-content-analytics" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                Logs for {selectedLogDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </h2>
                            <button className="btn btn-icon" onClick={() => setSelectedLogDate(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        {sessionsForSelectedDate.length === 0 ? (
                            <p className="text-muted text-center">No recorded focus sessions on this day.</p>
                        ) : (
                            <div className="modal-body">
                                {sessionsForSelectedDate.map((session: any) => (
                                    <div key={session.id} className="glass log-item">
                                        <div className="log-item-title">{session.subject_name}</div>
                                        <div className="log-item-time">{session.actual_minutes} min</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(() => {
                            const targetStr = toLocalDateStr(selectedLogDate);
                            const studied = allChapters.filter(ch =>
                                ch.lastStudiedAt && toLocalDateStr(new Date(ch.lastStudiedAt)) === targetStr
                            );
                            if (studied.length === 0) return null;
                            return (
                                <div className="log-modal-chapters">
                                    <div className="log-modal-chapters-title">📖 Chapitres révisés</div>
                                    {studied.map(ch => {
                                        const sub = subjects.find(s => s.id === ch.subjectId);
                                        return (
                                            <div key={ch.id} className="log-modal-chapter-item">
                                                <span className="log-modal-chapter-name">{ch.name}</span>
                                                {sub && <span className="log-modal-chapter-subject">{sub.name}</span>}
                                                <span className="log-modal-chapter-count">{ch.studyCount}/3</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ── Goal Date Modal ── */}
            {showGoalModal && (
                <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title-small"><Flag size={20} /> Add Goal Date</h2>
                            <button className="btn btn-icon" onClick={() => setShowGoalModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body-form">
                            <div className="form-group">
                                <label>Label (e.g. "Math Exam")</label>
                                <input type="text" value={newGoalLabel} onChange={e => setNewGoalLabel(e.target.value)}
                                    placeholder="Exam / Deadline name" className="form-input-full" />
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input type="date" value={newGoalDate} onChange={e => setNewGoalDate(e.target.value)}
                                    className="form-input-full" />
                            </div>
                            <button className="btn btn-primary w-full" onClick={addGoalDate}
                                disabled={!newGoalDate || !newGoalLabel.trim()}>
                                Add Goal
                            </button>
                        </div>
                        {goalDates.length > 0 && (
                            <div className="existing-goals-container">
                                <h4 className="existing-goals-title">Existing Goals</h4>
                                <div className="goals-list">
                                    {goalDates.sort((a, b) => a.date.localeCompare(b.date)).map(g => (
                                        <div key={g.id} className="goal-item">
                                            <div>
                                                <span className="goal-item-icon">🏁</span>
                                                <strong>{g.label}</strong>
                                                <span className="goal-item-date">{g.date}</span>
                                            </div>
                                            <button className="btn-icon" onClick={() => removeGoalDate(g.id)} title="Remove goal">
                                                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Main panels ── */}
            <div className="analytics-main-panel">
                {/* Heatmap */}
                <div className="heatmap-section heatmap-section-wrapper">
                    <div className="heatmap-header analytics-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarDays size={20} className="icon-blue" />
                            {currentHeatmapMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                        </h3>
                        <div className="heatmap-nav">
                            <button className="btn btn-secondary add-deadline-btn" onClick={() => setShowGoalModal(true)}>
                                <span className="add-deadline-plus">+</span> Add a deadline
                            </button>
                            <button className="btn btn-icon glass heatmap-nav-btn"
                                onClick={() => setCurrentHeatmapMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                                <ChevronLeft size={18} />
                            </button>
                            <button className="btn btn-icon glass heatmap-nav-btn"
                                onClick={() => setCurrentHeatmapMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="heatmap-grid" style={{ position: 'relative' }}>
                        {weekStart === 'monday' ? (
                            <>
                                <div className="calendar-day-header">Mon</div>
                                <div className="calendar-day-header">Tue</div>
                                <div className="calendar-day-header">Wed</div>
                                <div className="calendar-day-header">Thu</div>
                                <div className="calendar-day-header">Fri</div>
                                <div className="calendar-day-header">Sat</div>
                                <div className="calendar-day-header">Sun</div>
                            </>
                        ) : (
                            <>
                                <div className="calendar-day-header">Sun</div>
                                <div className="calendar-day-header">Mon</div>
                                <div className="calendar-day-header">Tue</div>
                                <div className="calendar-day-header">Wed</div>
                                <div className="calendar-day-header">Thu</div>
                                <div className="calendar-day-header">Fri</div>
                                <div className="calendar-day-header">Sat</div>
                            </>
                        )}
                        {Array.from({ length: emptyPrefixCount }).map((_, i) => (
                            <div key={`empty-${i}`} className="heatmap-cell empty" />
                        ))}
                        {heatmapData.map((d, i) => {
                            const isRainbow = d.mins > 0 && weeklyActiveDays === 7;
                            const isFlame = d.mins > 0 && weeklyActiveDays >= 5 && weeklyActiveDays < 7;
                            const dateStr = toLocalDateStr(d.date);
                            const goal = goalDateSet[dateStr];
                            return (
                                <div
                                    key={i}
                                    className={`heatmap-cell ${getIntensityClass(d.mins)} ${isRainbow ? 'rainbow-pulse' : ''} ${goal ? 'goal-cell' : ''}`}
                                    title={goal ? `🏁 ${goal.label} • ${d.tooltip}` : d.tooltip}
                                    style={{ cursor: d.mins > 0 || goal ? 'pointer' : 'default' }}
                                    onMouseEnter={() => { if (d.mins > 0 || goal) playSFX('hover_sound', theme); }}
                                    onClick={() => { if (d.mins > 0) setSelectedLogDate(d.date); }}
                                >
                                    {d.date.getDate()}
                                    {goal && <span className="goal-flag" title={goal.label}>🏁</span>}
                                    {!goal && isFlame && <span style={{ fontSize: '10px', pointerEvents: 'none', position: 'absolute', right: '4px', bottom: '2px' }}>🔥</span>}
                                    {!goal && isRainbow && <span style={{ fontSize: '10px', pointerEvents: 'none', position: 'absolute', right: '4px', bottom: '2px' }}>✨</span>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="heatmap-legend">
                        Less <span className="heatmap-cell h-level-0" />
                        <span className="heatmap-cell h-level-1" />
                        <span className="heatmap-cell h-level-2" />
                        <span className="heatmap-cell h-level-3" />
                        <span className="heatmap-cell h-level-4" /> More
                        <span style={{ marginLeft: '12px' }}>🏁 = Goal</span>
                    </div>
                </div>

                {/* Deadlines */}
                <div className="glass deadlines-panel">
                    <h3 className="panel-header"><Flag size={18} /> Upcoming Deadlines</h3>
                    {upcoming.length === 0 ? (
                        <p className="empty-state-text">No deadlines set yet.<br />Click "+ Add a deadline" to add one, or set it on a subject.</p>
                    ) : (
                        <div className="upcoming-list">
                            {upcoming.map((g, idx) => {
                                const goalDate = new Date(g.date + 'T00:00:00');
                                const now = new Date(); now.setHours(0, 0, 0, 0);
                                const totalDays = Math.ceil((goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                const months = Math.floor(totalDays / 30);
                                const weeks = Math.floor((totalDays % 30) / 7);
                                const days = totalDays % 7;
                                let countdown = totalDays === 0 ? 'Today!' : [
                                    months > 0 && `${months}mo`,
                                    weeks > 0 && `${weeks}w`,
                                    days > 0 && `${days}d`,
                                ].filter(Boolean).join(' ');

                                let cardClass = 'deadline-card';
                                if (totalDays <= 7) cardClass += ' urgent';
                                else if (totalDays <= 30) cardClass += ' soon';

                                return (
                                    <div key={`${g.id}-${idx}`} className={cardClass}>
                                        <div className="deadline-card-title">🏁 {g.label}</div>
                                        <div className="deadline-card-date">{g.date}</div>
                                        <div className="deadline-card-countdown">{countdown}</div>
                                        {g.type === 'manual' && (
                                            <button className="btn-icon remove-deadline-btn" onClick={() => removeGoalDate(g.id)} title="Remove deadline">
                                                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {pastWithResults.length > 0 && (
                        <div className="past-results-container">
                            <h4 className="past-results-title">Past Results</h4>
                            <div className="goals-list">
                                {pastWithResults.map((p, idx) => (
                                    <div key={`past-${p.id}-${idx}`} className="past-result-item">
                                        <div>
                                            <div className="past-result-label">{p.label}</div>
                                            <div className="past-result-date">{p.date}</div>
                                        </div>
                                        <div className="past-result-score">{p.result}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}
