import { useState, useEffect, useMemo } from 'react';
import { useCountUp } from '../lib/useCountUp';
import { useSettings } from '../lib/settings';
import { getSessions, getSubjects, getAllSessionBlocks } from '../lib/db';
import type { Session, Subject, SessionBlock } from '../lib/db';
import { Activity, Clock, Flame, Flag, PieChart as PieChartIcon, Zap } from 'lucide-react';
import { TECHNIQUES, getTierColor } from '../lib/techniques';
import { getAllChapters } from '../lib/chapters';
import type { Chapter } from '../lib/chapters';
import CalendarPanel from '../components/CalendarPanel';
import './Analytics.css';

// ── Helpers ──

function toLocalDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStartOfWeek(date: Date, weekStart: 'monday' | 'sunday') {
    const d = new Date(date);
    const day = d.getDay();
    const diff = weekStart === 'monday'
        ? d.getDate() - day + (day === 0 ? -6 : 1)
        : d.getDate() - day;
    return new Date(d.setDate(diff));
}

export default function AnalyticsTab() {
    const { weekStart } = useSettings();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [blocks, setBlocks] = useState<SessionBlock[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [allChapters, setAllChapters] = useState<Chapter[]>([]);
    const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
    const [timelineFilter, setTimelineFilter] = useState<number>(1);

    useEffect(() => {
        async function load() {
            try {
                const data = await getSessions();
                setSessions(data);

                const blks = await getAllSessionBlocks();
                setBlocks(blks);

                const subs = await getSubjects();
                setSubjects(subs);

                setAllChapters(getAllChapters());
            } catch (e) {
                console.error("Failed to load analytics data", e);
            }
        }
        load();
    }, []);

    const weeklyStats = useMemo(() => {
        const today = new Date();
        const startOfWeek = getStartOfWeek(today, weekStart);
        startOfWeek.setHours(0, 0, 0, 0);

        let weekMinutes = 0;
        let weekSessionsCount = 0;
        const weekDaysActive = new Set<string>();

        sessions.forEach(s => {
            const sd = new Date(s.started_at);
            if (sd >= startOfWeek) {
                weekMinutes += s.actual_minutes;
                weekSessionsCount++;
                weekDaysActive.add(toLocalDateStr(sd));
            }
        });

        return {
            minutes: weekMinutes,
            count: weekSessionsCount,
            days: weekDaysActive.size
        };
    }, [sessions, weekStart]);

    const streaks = useMemo(() => {
        const datesWithSessions = new Set<string>();
        sessions.forEach(s => {
            if (s.actual_minutes > 0) {
                datesWithSessions.add(toLocalDateStr(new Date(s.started_at)));
            }
        });

        const sortedDates = Array.from(datesWithSessions).sort();
        if (sortedDates.length === 0) return { current: 0, best: 0 };

        let best = 1;
        let current = 1;

        let lastDate = new Date(sortedDates[0]);
        for (let i = 1; i < sortedDates.length; i++) {
            const d = new Date(sortedDates[i]);
            const diffDays = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())) / (1000 * 3600 * 24));

            if (diffDays === 1) {
                current++;
                if (current > best) best = current;
            } else if (diffDays > 1) {
                current = 1;
            }
            lastDate = d;
        }

        const today = new Date();
        const diffToToday = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())) / (1000 * 3600 * 24));
        if (diffToToday > 1) {
            current = 0;
        }

        return { current, best: Math.max(current, best) };
    }, [sessions]);

    const animMinutes = useCountUp(weeklyStats.minutes);
    const animCount = useCountUp(weeklyStats.count);
    const animDays = useCountUp(weeklyStats.days);
    const animCurrentStreak = useCountUp(streaks.current);
    const animBestStreak = useCountUp(streaks.best);

    const pieChart = useMemo(() => {
        const tierMap: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
        const validSessionIds = new Set(sessions.map(s => s.id));

        let total = 0;
        blocks.forEach(b => {
            if (validSessionIds.has(b.session_id) && b.type === 'focus' && b.technique_id) {
                const tech = TECHNIQUES.find(t => t.id === b.technique_id);
                if (tech && tech.tier) {
                    tierMap[tech.tier] += b.minutes;
                    total += b.minutes;
                }
            }
        });

        if (total === 0) return { data: [], total: 0, dfRatio: 0 };

        const tierOrder = ['S', 'A', 'B', 'C', 'D', 'E', 'F'] as const;
        const data = tierOrder
            .map(t => ({
                tier: t,
                mins: tierMap[t],
                pct: Math.round((tierMap[t] / total) * 100),
                color: getTierColor(t as any) || '#ccc'
            }))
            .filter(d => d.mins > 0);

        const dfPct = Math.round(((tierMap['D'] + tierMap['F'] + tierMap['E']) / total) * 100);

        return { data, total, dfRatio: dfPct };
    }, [sessions, blocks]);

    const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
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
            dailyTotals[toLocalDateStr(itr)] = 0;
            itr.setDate(itr.getDate() + 1);
        }

        sessions.forEach(s => {
            const sd = new Date(s.started_at);
            if (sd >= startPeriod && sd <= now) {
                const dStr = toLocalDateStr(sd);
                if (dailyTotals[dStr] !== undefined) {
                    dailyTotals[dStr] += (s.actual_minutes || 0);
                }
            }
        });

        const sortedDays = Object.keys(dailyTotals).sort();
        const data = sortedDays.map(dateStr => ({
            dateStr,
            date: new Date(dateStr + 'T12:00:00'),
            minutes: dailyTotals[dateStr]
        }));

        const maxMins = Math.max(...data.map(d => d.minutes), 60);
        const studiedDays = data.filter(d => d.minutes > 0).length;
        const totalPeriodMinutes = data.reduce((acc, d) => acc + d.minutes, 0);

        return { data, maxMins, studiedDays, totalPeriodMinutes };
    }, [sessions, timelineFilter]);

    return (
        <div className="analytics-tab">
            <div className="analytics-summary">
                <div className="analytics-header">
                    <h3>This Week</h3>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <Clock className="stat-icon" size={20} />
                        <div className="stat-val">{formatTime(animMinutes)}</div>
                        <div className="stat-label">Focus Time</div>
                    </div>

                    <div className="stat-card">
                        <Activity className="stat-icon" size={20} />
                        <div className="stat-val">{animCount}</div>
                        <div className="stat-label">Sessions</div>
                    </div>

                    <div className="stat-card">
                        <Flame className="stat-icon danger-text" size={20} />
                        <div className="stat-val">{animDays} / 7</div>
                        <div className="stat-label">Active Days</div>
                    </div>

                    <div className="stat-card">
                        <Zap className="stat-icon" size={20} style={{ color: 'var(--accent)' }} />
                        <div className="stat-val">{animCurrentStreak} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>days</span></div>
                        <div className="stat-label">Current Streak</div>
                    </div>

                    <div className="stat-card">
                        <Flag className="stat-icon" size={20} style={{ color: 'var(--success)' }} />
                        <div className="stat-val">{animBestStreak} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>days</span></div>
                        <div className="stat-label">Best Streak</div>
                    </div>
                </div>
            </div>

            <div className="analytics-panels">
                <CalendarPanel
                    sessions={sessions}
                    blocks={blocks}
                    subjects={subjects}
                    allChapters={allChapters}
                    weeklyActiveDays={weeklyStats.days}
                />

                {/* ── Technique Pie Chart ── */}
                <div className="glass pie-chart-panel">
                    <h3 className="panel-header">
                        <PieChartIcon size={18} /> Technique Tiers
                    </h3>

                    {pieChart.total === 0 ? (
                        <p className="empty-state-text">No techniques logged yet.</p>
                    ) : (
                        <div className="pie-chart-container">
                            <div className="pie-chart-circle" style={{
                                background: `conic-gradient(${pieChart.data.reduce((acc, slice, idx) => {
                                    const prevPct = idx === 0 ? 0 : pieChart.data.slice(0, idx).reduce((sum, d) => sum + d.pct, 0);
                                    const endPct = prevPct + slice.pct;
                                    const colorStr = slice.color.startsWith('linear-gradient') ? slice.color.split(',')[1].trim() : slice.color;
                                    return acc + (idx > 0 ? ', ' : '') + `${colorStr} ${prevPct}% ${endPct}%`;
                                }, '')
                                    })`
                            }}>
                                <div className="pie-chart-center">
                                    {pieChart.data[0]?.tier}
                                    <span className="pie-chart-center-sub">Top Tier</span>
                                </div>
                            </div>

                            <div className="pie-chart-legend">
                                {pieChart.data.map(slice => (
                                    <div key={slice.tier} className="pie-chart-legend-item">
                                        <div className="legend-item-left">
                                            <div className="legend-item-color" style={{ background: slice.color.startsWith('linear-gradient') ? slice.color.split(',')[1].trim() : slice.color }}></div>
                                            <span className="legend-item-label">Tier {slice.tier}</span>
                                        </div>
                                        <div className="legend-item-right">
                                            {slice.pct}% <span className="legend-item-mins">({Math.round(slice.mins)}m)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {pieChart.dfRatio >= 30 && (
                                <div className="pie-chart-warning">
                                    <strong>Warning:</strong> {pieChart.dfRatio}% of your study time is spent on highly inefficient D/F techniques. Focus on Active Recall (S/A tier).
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="glass timeline-panel">
                <div className="timeline-header">
                    <h3 className="timeline-title">
                        <Activity size={20} className="icon-blue" />
                        Study Time Graph
                    </h3>
                    <div className="timeline-controls">
                        <div className="timeline-stats-text">
                            I studied {timelineData.studiedDays} days, {formatTime(timelineData.totalPeriodMinutes)} for the last
                        </div>
                        <select
                            value={timelineFilter}
                            onChange={e => setTimelineFilter(parseFloat(e.target.value))}
                            className="timeline-select"
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
                </div>

                <div className="timeline-graph-container">
                    {/* Y-axis labels */}
                    <div className="y-axis-labels">
                        <span className="y-axis-label">{formatTime(timelineData.maxMins)}</span>
                        <span className="y-axis-label">{formatTime(Math.round(timelineData.maxMins * 2 / 3))}</span>
                        <span className="y-axis-label">{formatTime(Math.round(timelineData.maxMins / 3))}</span>
                        <span className="y-axis-label">0m</span>
                    </div>
                    <div className="graph-bars-wrapper">
                        {timelineData.data.map((day, i) => {
                            const heightPct = Math.max((day.minutes / timelineData.maxMins) * 100, day.minutes > 0 ? 2 : 0);
                            const isToday = toLocalDateStr(new Date()) === day.dateStr;
                            const isHovered = hoveredBarIdx === i;
                            return (
                                <div
                                    key={i}
                                    className="graph-bar-col"
                                    onMouseEnter={() => setHoveredBarIdx(i)}
                                    onMouseLeave={() => setHoveredBarIdx(null)}
                                >
                                    {isHovered && day.minutes > 0 && (
                                        <div className="graph-tooltip" style={{
                                            top: `${Math.max(100 - heightPct - 15, 0)}%`,
                                        }}>
                                            {formatTime(day.minutes)}
                                            <div className="graph-tooltip-date">
                                                {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className="graph-bar graph-bar-hover"
                                        style={{
                                            height: `${heightPct}%`,
                                            background: isToday ? 'var(--accent)' : 'var(--primary)',
                                            opacity: isHovered ? 1 : (day.minutes > 0 ? 0.8 : 0.1),
                                            cursor: day.minutes > 0 ? 'pointer' : 'default',
                                        }}
                                    />
                                    {timelineData.data.length <= 14 && (
                                        <div className="x-axis-label">
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
