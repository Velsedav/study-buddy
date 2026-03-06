import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../lib/settings';
import { getSessions, getSubjects } from '../lib/db';
import type { Session, Subject } from '../lib/db';
import { Activity, Clock, CalendarDays, Flame, ChevronLeft, ChevronRight, X, Flag, Trash2 } from 'lucide-react';
import { playSFX } from '../lib/sounds';

// ── Goal Dates ──

interface GoalDate {
    id: string;
    date: string; // YYYY-MM-DD
    label: string;
}

function loadGoalDates(): GoalDate[] {
    try {
        const saved = localStorage.getItem('study-buddy-goal-dates');
        if (saved) return JSON.parse(saved);
    } catch { }
    return [];
}

function saveGoalDates(goals: GoalDate[]) {
    localStorage.setItem('study-buddy-goal-dates', JSON.stringify(goals));
}

// ── Fake Data Generator ──

function generateFakeData(): Session[] {
    const fakeSessions: Session[] = [];
    const now = new Date();

    // Generate 6 months of fake data
    for (let daysAgo = 0; daysAgo < 180; daysAgo++) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        date.setHours(9, 0, 0, 0);

        // Probability of studying on a given day (higher on weekdays)
        const dayOfWeek = date.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const studyProbability = isWeekday ? 0.75 : 0.4;

        if (Math.random() > studyProbability) continue;

        // 1-3 sessions per day
        const sessionsCount = 1 + Math.floor(Math.random() * 3);

        for (let s = 0; s < sessionsCount; s++) {
            const hour = 8 + Math.floor(Math.random() * 12);
            const startDate = new Date(date);
            startDate.setHours(hour, Math.floor(Math.random() * 60));

            // Session duration: 15-120 minutes, weighted toward 25-50
            let minutes: number;
            const r = Math.random();
            if (r < 0.4) minutes = 25;
            else if (r < 0.7) minutes = 50;
            else if (r < 0.85) minutes = 15 + Math.floor(Math.random() * 35);
            else minutes = 60 + Math.floor(Math.random() * 60);

            const endDate = new Date(startDate.getTime() + minutes * 60000);

            fakeSessions.push({
                id: `fake-${daysAgo}-${s}`,
                started_at: startDate.toISOString(),
                ended_at: endDate.toISOString(),
                template: r < 0.5 ? '25/5' : '50/10',
                repeats: 1,
                planned_minutes: minutes,
                actual_minutes: minutes,
            });
        }
    }

    return fakeSessions;
}

// ── Helpers ──

function getStartOfWeek(date: Date, weekStart: 'monday' | 'sunday') {
    const d = new Date(date);
    const day = d.getDay();
    const diff = weekStart === 'monday'
        ? d.getDate() - day + (day === 0 ? -6 : 1)
        : d.getDate() - day;
    return new Date(d.setDate(diff));
}

export default function AnalyticsTab() {
    const { weekStart, theme } = useSettings();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [useFakeData, setUseFakeData] = useState(false);
    const [fakeData] = useState<Session[]>(() => generateFakeData());
    const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

    const [currentHeatmapMonth, setCurrentHeatmapMonth] = useState(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);
    const [timelineFilter, setTimelineFilter] = useState<number>(1);

    // Goal dates state
    const [goalDates, setGoalDates] = useState<GoalDate[]>(loadGoalDates);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [newGoalDate, setNewGoalDate] = useState('');
    const [newGoalLabel, setNewGoalLabel] = useState('');

    useEffect(() => {
        saveGoalDates(goalDates);
    }, [goalDates]);

    useEffect(() => {
        async function load() {
            try {
                const data = await getSessions();
                setSessions(data);

                const subs = await getSubjects();
                setSubjects(subs);
            } catch (e) {
                console.error("Failed to load sessions", e);
            }
        }
        load();
    }, []);

    const activeSessions = useFakeData ? fakeData : sessions;

    const { heatmapData, weeklyStats } = useMemo(() => {
        const today = new Date();
        const startOfWeek = getStartOfWeek(today, weekStart);
        startOfWeek.setHours(0, 0, 0, 0);

        let weekMinutes = 0;
        let weekSessionsCount = 0;
        let weekDaysActive = new Set<string>();

        activeSessions.forEach(s => {
            const dateStr = s.started_at.split('T')[0];
            const sd = new Date(s.started_at);

            if (sd >= startOfWeek) {
                weekMinutes += s.actual_minutes;
                weekSessionsCount++;
                weekDaysActive.add(dateStr);
            }
        });

        // Heatmap - Current Selected Month
        const year = currentHeatmapMonth.getFullYear();
        const month = currentHeatmapMonth.getMonth();
        const startNodeDate = new Date(year, month, 1);
        const nextMonthDate = new Date(year, month + 1, 1);

        const monthDays: Date[] = [];
        let itr = new Date(startNodeDate);
        while (itr < nextMonthDate) {
            monthDays.push(new Date(itr));
            itr.setDate(itr.getDate() + 1);
        }

        const mapData = monthDays.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            const daySessions = activeSessions.filter(s => {
                const sd = new Date(s.started_at);
                return sd.toISOString().split('T')[0] === dateStr;
            });

            let dayMin = 0;
            daySessions.forEach(s => { if (s.actual_minutes) dayMin += s.actual_minutes });

            let tooltip = date.toLocaleDateString();
            if (dayMin > 0) {
                tooltip += ` - ${dayMin} minutes (${daySessions.length} sessions)`;
            } else {
                tooltip += ' - No sessions';
            }

            return { date, mins: dayMin, tooltip, sessions: daySessions };
        });

        return {
            heatmapData: mapData,
            weeklyStats: {
                minutes: weekMinutes,
                count: weekSessionsCount,
                days: weekDaysActive.size
            }
        };
    }, [activeSessions, weekStart, currentHeatmapMonth]);

    // Filtering and Daily Logs Extractor
    const sessionsForSelectedDate = useMemo(() => {
        if (!selectedLogDate) return [];
        const targetStr = selectedLogDate.toISOString().split('T')[0];

        return (heatmapData.find(d => d.date.toISOString().split('T')[0] === targetStr)?.sessions || [])
            .map((session: any) => {
                const attachedSub = subjects.find(s => s.id === session.subject_id);
                return {
                    ...session,
                    subject_name: attachedSub ? attachedSub.name : (useFakeData ? 'Sample Subject' : 'Unknown Subject')
                };
            });
    }, [selectedLogDate, heatmapData, subjects, useFakeData]);

    const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const getIntensityClass = (mins: number) => {
        if (mins === 0) return 'h-level-0';
        if (mins < 30) return 'h-level-1';
        if (mins < 60) return 'h-level-2';
        if (mins < 120) return 'h-level-3';
        return 'h-level-4';
    };

    // Timeline logic
    const timelineData = useMemo(() => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        let startPeriod = new Date(now);

        if (timelineFilter === 0.25) {
            startPeriod.setDate(now.getDate() - 7);
        } else if (timelineFilter === 0.5) {
            startPeriod.setDate(now.getDate() - 14);
        } else {
            startPeriod.setMonth(now.getMonth() - timelineFilter);
        }
        startPeriod.setHours(0, 0, 0, 0);

        const dailyTotals: Record<string, number> = {};

        let itr = new Date(startPeriod);
        while (itr <= now) {
            dailyTotals[itr.toISOString().split('T')[0]] = 0;
            itr.setDate(itr.getDate() + 1);
        }

        activeSessions.forEach(s => {
            const sd = new Date(s.started_at);
            if (sd >= startPeriod && sd <= now) {
                const dStr = sd.toISOString().split('T')[0];
                if (dailyTotals[dStr] !== undefined) {
                    dailyTotals[dStr] += (s.actual_minutes || 0);
                }
            }
        });

        const sortedDays = Object.keys(dailyTotals).sort();
        const data = sortedDays.map(dateStr => ({
            dateStr,
            date: new Date(dateStr),
            minutes: dailyTotals[dateStr]
        }));

        const maxMins = Math.max(...data.map(d => d.minutes), 60);

        return { data, maxMins };
    }, [activeSessions, timelineFilter]);

    // Goal dates helpers
    const goalDateSet = useMemo(() => {
        const map: Record<string, GoalDate> = {};
        for (const g of goalDates) map[g.date] = g;
        return map;
    }, [goalDates]);

    const addGoalDate = () => {
        if (!newGoalDate || !newGoalLabel.trim()) return;
        const goal: GoalDate = {
            id: crypto.randomUUID(),
            date: newGoalDate,
            label: newGoalLabel.trim(),
        };
        setGoalDates(prev => [...prev, goal]);
        setNewGoalDate('');
        setNewGoalLabel('');
        setShowGoalModal(false);
    };

    const removeGoalDate = (id: string) => {
        setGoalDates(prev => prev.filter(g => g.id !== id));
    };

    return (
        <div className="analytics-tab">
            <div className="analytics-summary">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>This Week</h3>
                    <button
                        className={`btn btn-secondary`}
                        style={{ fontSize: '0.78rem', padding: '4px 12px', opacity: useFakeData ? 1 : 0.6 }}
                        onClick={() => setUseFakeData(!useFakeData)}
                        title={useFakeData ? 'Switch to real data' : 'Show demo data'}
                    >
                        {useFakeData ? '📊 Demo Mode' : '📊 Demo'}
                    </button>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <Clock className="stat-icon" size={20} />
                        <div className="stat-val">{formatTime(weeklyStats.minutes)}</div>
                        <div className="stat-label">Focus Time</div>
                    </div>

                    <div className="stat-card">
                        <Activity className="stat-icon" size={20} />
                        <div className="stat-val">{weeklyStats.count}</div>
                        <div className="stat-label">Sessions</div>
                    </div>

                    <div className="stat-card">
                        <Flame className="stat-icon danger-text" size={20} />
                        <div className="stat-val">{weeklyStats.days} / 7</div>
                        <div className="stat-label">Active Days</div>
                    </div>
                </div>
            </div>

            {selectedLogDate && (
                <div className="modal-overlay" onClick={() => setSelectedLogDate(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                                Logs for {selectedLogDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </h2>
                            <button className="btn btn-icon" onClick={() => setSelectedLogDate(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        {sessionsForSelectedDate.length === 0 ? (
                            <p className="text-muted text-center">No recorded focus sessions on this day.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {sessionsForSelectedDate.map(session => (
                                    <div key={session.id} className="glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{session.subject_name}</div>
                                        <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{session.actual_minutes} min</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Goal Date Modal */}
            {showGoalModal && (
                <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Flag size={20} />
                                Add Goal Date
                            </h2>
                            <button className="btn btn-icon" onClick={() => setShowGoalModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label>Label (e.g. "Math Exam")</label>
                                <input
                                    type="text"
                                    value={newGoalLabel}
                                    onChange={e => setNewGoalLabel(e.target.value)}
                                    placeholder="Exam / Deadline name"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={newGoalDate}
                                    onChange={e => setNewGoalDate(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <button
                                className="btn btn-primary w-full"
                                onClick={addGoalDate}
                                disabled={!newGoalDate || !newGoalLabel.trim()}
                            >
                                Add Goal
                            </button>
                        </div>

                        {goalDates.length > 0 && (
                            <div style={{ marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                                <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Existing Goals</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {goalDates.sort((a, b) => a.date.localeCompare(b.date)).map(g => (
                                        <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(var(--primary-rgb), 0.06)', borderRadius: '8px' }}>
                                            <div>
                                                <span style={{ marginRight: '8px' }}>🏁</span>
                                                <strong>{g.label}</strong>
                                                <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.85rem' }}>{g.date}</span>
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

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div className="heatmap-section" style={{ flex: 1 }}>
                    <div className="heatmap-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarDays size={20} className="icon-blue" />
                            {currentHeatmapMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => setShowGoalModal(true)}
                            >
                                <Flag size={14} /> Goals
                            </button>
                            <button
                                className="btn btn-icon glass"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => setCurrentHeatmapMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                className="btn btn-icon glass"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => setCurrentHeatmapMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="heatmap-grid" style={{ position: 'relative' }}>
                        {(() => {
                            const firstDayOfMonthDate = new Date(currentHeatmapMonth.getFullYear(), currentHeatmapMonth.getMonth(), 1);
                            const firstDayOfWeek = firstDayOfMonthDate.getDay();
                            const emptyPrefixCount = weekStart === 'monday'
                                ? (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1)
                                : firstDayOfWeek;

                            return (
                                <>
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
                                        <div key={`empty-${i}`} className="heatmap-cell empty"></div>
                                    ))}
                                    {heatmapData.map((d, i) => {
                                        const isRainbow = d.mins > 0 && weeklyStats.days === 7;
                                        const isFlame = d.mins > 0 && weeklyStats.days >= 5 && weeklyStats.days < 7;
                                        const dateStr = d.date.toISOString().split('T')[0];
                                        const goal = goalDateSet[dateStr];

                                        return (
                                            <div
                                                key={i}
                                                className={`heatmap-cell ${getIntensityClass(d.mins)} ${isRainbow ? 'rainbow-pulse' : ''} ${goal ? 'goal-cell' : ''}`}
                                                title={goal ? `🏁 ${goal.label} • ${d.tooltip}` : d.tooltip}
                                                style={{ cursor: d.mins > 0 || goal ? 'pointer' : 'default' }}
                                                onMouseEnter={() => { if (d.mins > 0 || goal) playSFX('hover_sound', theme); }}
                                                onClick={() => {
                                                    if (d.mins > 0) setSelectedLogDate(d.date);
                                                }}
                                            >
                                                {d.date.getDate()}
                                                {goal && <span className="goal-flag" title={goal.label}>🏁</span>}
                                                {!goal && isFlame && <span style={{ fontSize: '10px', pointerEvents: 'none', position: 'absolute', right: '4px', bottom: '2px' }}>🔥</span>}
                                                {!goal && isRainbow && <span style={{ fontSize: '10px', pointerEvents: 'none', position: 'absolute', right: '4px', bottom: '2px' }}>✨</span>}
                                            </div>
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </div>
                    <div className="heatmap-legend">
                        Less <span className="heatmap-cell h-level-0"></span>
                        <span className="heatmap-cell h-level-1"></span>
                        <span className="heatmap-cell h-level-2"></span>
                        <span className="heatmap-cell h-level-3"></span>
                        <span className="heatmap-cell h-level-4"></span> More
                        <span style={{ marginLeft: '12px' }}>🏁 = Goal</span>
                    </div>
                </div>

                {/* ── Upcoming Goals Panel ── */}
                <div className="glass" style={{ width: '280px', flexShrink: 0, padding: '20px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                        <Flag size={18} /> Upcoming Goals
                    </h3>
                    {goalDates.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto 0' }}>No goals set yet.<br />Click "Goals" to add one.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                            {goalDates
                                .filter(g => new Date(g.date + 'T00:00:00') >= new Date(new Date().toISOString().split('T')[0] + 'T00:00:00'))
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map(g => {
                                    const goalDate = new Date(g.date + 'T00:00:00');
                                    const now = new Date();
                                    now.setHours(0, 0, 0, 0);
                                    const diffMs = goalDate.getTime() - now.getTime();
                                    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                    const months = Math.floor(totalDays / 30);
                                    const weeks = Math.floor((totalDays % 30) / 7);
                                    const days = totalDays % 7;

                                    let countdown = '';
                                    if (totalDays === 0) countdown = 'Today!';
                                    else {
                                        const parts: string[] = [];
                                        if (months > 0) parts.push(`${months}mo`);
                                        if (weeks > 0) parts.push(`${weeks}w`);
                                        if (days > 0) parts.push(`${days}d`);
                                        countdown = parts.join(' ');
                                    }

                                    return (
                                        <div key={g.id} style={{
                                            padding: '12px',
                                            background: 'rgba(var(--primary-rgb), 0.06)',
                                            borderRadius: '12px',
                                            borderLeft: totalDays <= 7 ? '3px solid var(--danger)' : totalDays <= 30 ? '3px solid var(--accent)' : '3px solid var(--primary)',
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>🏁 {g.label}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{g.date}</div>
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: 'bold',
                                                color: totalDays <= 7 ? 'var(--danger)' : totalDays <= 30 ? 'var(--accent)' : 'var(--primary)',
                                            }}>
                                                {countdown}
                                            </div>
                                            <button
                                                className="btn-icon"
                                                onClick={() => removeGoalDate(g.id)}
                                                title="Remove goal"
                                                style={{ position: 'absolute', right: '8px', top: '8px' }}
                                            >
                                            </button>
                                        </div>
                                    );
                                })}
                            {goalDates.filter(g => new Date(g.date + 'T00:00:00') >= new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')).length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>All goals have passed.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius)', marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={20} className="icon-blue" />
                        Study Time Graph
                    </h3>
                    <select
                        value={timelineFilter}
                        onChange={e => setTimelineFilter(parseFloat(e.target.value))}
                        style={{ width: 'auto', minWidth: '150px' }}
                    >
                        <option value={0.25}>Last Week</option>
                        <option value={0.5}>Last 2 Weeks</option>
                        <option value={1}>Last Month</option>
                        <option value={2}>Last 2 Months</option>
                        <option value={3}>Last 3 Months</option>
                        <option value={4}>Last 4 Months</option>
                        <option value={5}>Last 5 Months</option>
                        <option value={6}>Last 6 Months</option>
                        <option value={7}>Last 7 Months</option>
                        <option value={8}>Last 8 Months</option>
                        <option value={9}>Last 9 Months</option>
                        <option value={10}>Last 10 Months</option>
                        <option value={11}>Last 11 Months</option>
                        <option value={12}>Last 12 Months</option>
                    </select>
                </div>

                <div style={{ display: 'flex', marginTop: '32px' }}>
                    {/* Y-axis labels */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: '8px', height: '200px', minWidth: '40px' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatTime(timelineData.maxMins)}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatTime(Math.round(timelineData.maxMins * 2 / 3))}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatTime(Math.round(timelineData.maxMins / 3))}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>0m</span>
                    </div>
                    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '2px', flex: 1, position: 'relative' }}>
                        {timelineData.data.map((day, i) => {
                            const heightPct = Math.max((day.minutes / timelineData.maxMins) * 100, day.minutes > 0 ? 2 : 0);
                            const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                            const isHovered = hoveredBarIdx === i;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        flex: 1,
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'flex-end',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={() => setHoveredBarIdx(i)}
                                    onMouseLeave={() => setHoveredBarIdx(null)}
                                >
                                    {/* Hover tooltip */}
                                    {isHovered && day.minutes > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: `${Math.max(100 - heightPct - 15, 0)}%`,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'var(--card-bg)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            padding: '6px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            color: 'var(--text-dark)',
                                            whiteSpace: 'nowrap',
                                            zIndex: 20,
                                            boxShadow: 'var(--shadow-md)',
                                            pointerEvents: 'none',
                                        }}>
                                            {formatTime(day.minutes)}
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                                {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            width: '100%',
                                            height: `${heightPct}%`,
                                            background: isToday ? 'var(--accent)' : 'var(--primary)',
                                            borderRadius: '4px 4px 0 0',
                                            transition: 'height 0.3s ease, opacity 0.15s',
                                            opacity: isHovered ? 1 : (day.minutes > 0 ? 0.8 : 0.1),
                                            cursor: day.minutes > 0 ? 'pointer' : 'default',
                                        }}
                                        className="graph-bar-hover"
                                    />
                                    {timelineData.data.length <= 14 && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '-20px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            fontSize: '0.65rem',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {day.date.getDate()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
