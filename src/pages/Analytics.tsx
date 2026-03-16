import { useState, useEffect, useMemo } from 'react';
import { useCountUp } from '../lib/useCountUp';
import { useSettings } from '../lib/settings';
import { useTranslation } from '../lib/i18n';
import { getSessions, getSubjects, getAllSessionBlocks, getMetacognitionLogs } from '../lib/db';
import type { Session, Subject, SessionBlock, MetacognitionLog } from '../lib/db';
import { Activity, Clock, Flame, Flag, PieChart as PieChartIcon, Zap, BarChart2, Target } from 'lucide-react';
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

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

export default function AnalyticsTab() {
    const { weekStart } = useSettings();
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [blocks, setBlocks] = useState<SessionBlock[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [allChapters, setAllChapters] = useState<Chapter[]>([]);
    const [metacogLogs, setMetacogLogs] = useState<MetacognitionLog[]>([]);
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

                const logs = await getMetacognitionLogs();
                setMetacogLogs(logs);
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

    const monthlyStats = useMemo(() => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        let monthMinutes = 0;
        let monthSessionsCount = 0;
        const monthDaysActive = new Set<string>();

        sessions.forEach(s => {
            const sd = new Date(s.started_at);
            if (sd >= startOfMonth) {
                monthMinutes += s.actual_minutes;
                monthSessionsCount++;
                monthDaysActive.add(toLocalDateStr(sd));
            }
        });

        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        return {
            minutes: monthMinutes,
            count: monthSessionsCount,
            days: monthDaysActive.size,
            daysInMonth,
        };
    }, [sessions]);

    const totalStats = useMemo(() => {
        const totalDays = new Set(sessions.filter(s => s.actual_minutes > 0).map(s => toLocalDateStr(new Date(s.started_at)))).size;
        return {
            minutes: sessions.reduce((sum, s) => sum + (s.actual_minutes || 0), 0),
            count: sessions.length,
            days: totalDays,
        };
    }, [sessions]);

    const weekFreeTimePercent = useMemo((): number | null => {
        const today = new Date();
        const wkStart = getWeekStart(today);
        const weekEnd = new Date(wkStart);
        weekEnd.setDate(wkStart.getDate() + 7);

        const weekSessions = sessions.filter(s => {
            const sd = new Date(s.started_at);
            return sd >= wkStart && sd < weekEnd;
        });
        const weekStudyMinutes = weekSessions.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);

        const logsThisWeek = metacogLogs.filter(log => {
            const ld = new Date(log.created_at);
            return ld >= wkStart && ld < weekEnd && (log.free_time_hours ?? 0) > 0;
        });
        if (logsThisWeek.length === 0) return null;

        const mostRecent = logsThisWeek[0];
        return Math.round((weekStudyMinutes / 60) / mostRecent.free_time_hours! * 100);
    }, [sessions, metacogLogs]);

    const monthFreeTimePercent = useMemo((): number | null => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const logsThisMonth = metacogLogs.filter(log => {
            const ld = new Date(log.created_at);
            return ld >= startOfMonth && ld < endOfMonth && (log.free_time_hours ?? 0) > 0;
        });
        if (logsThisMonth.length === 0) return null;

        const percentages = logsThisMonth.map(log => {
            const logWeekStart = getWeekStart(new Date(log.created_at));
            const logWeekEnd = new Date(logWeekStart);
            logWeekEnd.setDate(logWeekStart.getDate() + 7);
            const weekStudyMinutes = sessions
                .filter(s => {
                    const sd = new Date(s.started_at);
                    return sd >= logWeekStart && sd < logWeekEnd;
                })
                .reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
            return (weekStudyMinutes / 60) / log.free_time_hours! * 100;
        });
        return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    }, [sessions, metacogLogs]);

    const totalFreeTimePercent = useMemo((): number | null => {
        const logsWithFreeTime = metacogLogs.filter(log => (log.free_time_hours ?? 0) > 0);
        if (logsWithFreeTime.length === 0) return null;

        const percentages = logsWithFreeTime.map(log => {
            const logWeekStart = getWeekStart(new Date(log.created_at));
            const logWeekEnd = new Date(logWeekStart);
            logWeekEnd.setDate(logWeekStart.getDate() + 7);
            const weekStudyMinutes = sessions
                .filter(s => {
                    const sd = new Date(s.started_at);
                    return sd >= logWeekStart && sd < logWeekEnd;
                })
                .reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
            return (weekStudyMinutes / 60) / log.free_time_hours! * 100;
        });
        return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    }, [sessions, metacogLogs]);

    const animMinutes = useCountUp(weeklyStats.minutes);
    const animCount = useCountUp(weeklyStats.count);
    const animDays = useCountUp(weeklyStats.days);
    const animCurrentStreak = useCountUp(streaks.current);
    const animBestStreak = useCountUp(streaks.best);
    const animMonthMinutes = useCountUp(monthlyStats.minutes);
    const animMonthCount = useCountUp(monthlyStats.count);
    const animMonthDays = useCountUp(monthlyStats.days);
    const animTotalMinutes = useCountUp(totalStats.minutes);
    const animTotalCount = useCountUp(totalStats.count);
    const animTotalDays = useCountUp(totalStats.days);
    const animWeekFreeTime = useCountUp(weekFreeTimePercent ?? 0);
    const animMonthFreeTime = useCountUp(monthFreeTimePercent ?? 0);
    const animTotalFreeTime = useCountUp(totalFreeTimePercent ?? 0);

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

    // Build dropdown options for timeline filter
    const timelineOptions = [
        { value: 0.25, label: t('analytics.last_week') },
        { value: 0.5, label: t('analytics.last_2_weeks') },
        { value: 1, label: t('analytics.last_month') },
        ...([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
            value: n,
            label: t('analytics.last_n_months').replace('{n}', String(n))
        })))
    ];

    return (
        <div className="analytics-tab fade-in">
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-green"><BarChart2 size={20} /></div>
                    <h1>{t('analytics.title')}</h1>
                </div>
            </div>
            <div className="analytics-summaries-row">
            <div className="analytics-summary">
                <div className="analytics-header">
                    <h3>{t('analytics.this_week')}</h3>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <Clock className="stat-icon" size={20} />
                        <div className="stat-val">{formatTime(animMinutes)}</div>
                        <div className="stat-label">{t('analytics.focus_time')}</div>
                    </div>

                    <div className="stat-card">
                        <Activity className="stat-icon" size={20} />
                        <div className="stat-val">{animCount}</div>
                        <div className="stat-label">{t('analytics.sessions')}</div>
                    </div>

                    <div className="stat-card">
                        <Flame className="stat-icon danger-text" size={20} />
                        <div className="stat-val">{animDays} / 7</div>
                        <div className="stat-label">{t('analytics.active_days')}</div>
                    </div>

                    <div className="stat-card">
                        <Zap className="stat-icon stat-icon-accent" size={20} />
                        <div className="stat-val">{animCurrentStreak} <span className="stat-days-suffix">{t('analytics.days')}</span></div>
                        <div className="stat-label">{t('analytics.current_streak')}</div>
                    </div>

                    <div className="stat-card">
                        <Flag className="stat-icon stat-icon-success" size={20} />
                        <div className="stat-val">{animBestStreak} <span className="stat-days-suffix">{t('analytics.days')}</span></div>
                        <div className="stat-label">{t('analytics.best_streak')}</div>
                    </div>

                    <div className="stat-card">
                        <Target size={20} className="stat-icon" />
                        <div className="stat-val">{weekFreeTimePercent !== null ? `${animWeekFreeTime}%` : '—'}</div>
                        <div className="stat-label">{t('analytics.free_time_used')}</div>
                    </div>
                </div>
            </div>

            <div className="analytics-summary">
                <div className="analytics-header">
                    <h3>{t('analytics.this_month')}</h3>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <Clock className="stat-icon" size={20} />
                        <div className="stat-val">{formatTime(animMonthMinutes)}</div>
                        <div className="stat-label">{t('analytics.focus_time')}</div>
                    </div>

                    <div className="stat-card">
                        <Activity className="stat-icon" size={20} />
                        <div className="stat-val">{animMonthCount}</div>
                        <div className="stat-label">{t('analytics.sessions')}</div>
                    </div>

                    <div className="stat-card">
                        <Flame className="stat-icon danger-text" size={20} />
                        <div className="stat-val">{animMonthDays} / {monthlyStats.daysInMonth}</div>
                        <div className="stat-label">{t('analytics.active_days')}</div>
                    </div>

                    <div className="stat-card">
                        <Target size={20} className="stat-icon" />
                        <div className="stat-val">{monthFreeTimePercent !== null ? `${animMonthFreeTime}%` : '—'}</div>
                        <div className="stat-label">{t('analytics.free_time_used')}</div>
                    </div>
                </div>
            </div>

            <div className="analytics-summary">
                <div className="analytics-header">
                    <h3>{t('analytics.total')}</h3>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <Clock className="stat-icon" size={20} />
                        <div className="stat-val">{formatTime(animTotalMinutes)}</div>
                        <div className="stat-label">{t('analytics.focus_time')}</div>
                    </div>

                    <div className="stat-card">
                        <Activity className="stat-icon" size={20} />
                        <div className="stat-val">{animTotalCount}</div>
                        <div className="stat-label">{t('analytics.sessions')}</div>
                    </div>

                    <div className="stat-card">
                        <Flame className="stat-icon danger-text" size={20} />
                        <div className="stat-val">{animTotalDays}</div>
                        <div className="stat-label">{t('analytics.active_days')}</div>
                    </div>

                    <div className="stat-card">
                        <Flag className="stat-icon stat-icon-success" size={20} />
                        <div className="stat-val">{animBestStreak} <span className="stat-days-suffix">{t('analytics.days')}</span></div>
                        <div className="stat-label">{t('analytics.best_streak')}</div>
                    </div>

                    <div className="stat-card">
                        <Target size={20} className="stat-icon" />
                        <div className="stat-val">{totalFreeTimePercent !== null ? `${animTotalFreeTime}%` : '—'}</div>
                        <div className="stat-label">{t('analytics.free_time_used')}</div>
                    </div>
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
                        <PieChartIcon size={18} /> {t('analytics.technique_tiers')}
                    </h3>

                    {pieChart.total === 0 ? (
                        <p className="empty-state-text">{t('analytics.no_techniques')}</p>
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
                                    <span className="pie-chart-center-sub">{t('analytics.top_tier')}</span>
                                </div>
                            </div>

                            <div className="pie-chart-legend">
                                {pieChart.data.map(slice => (
                                    <div key={slice.tier} className="pie-chart-legend-item">
                                        <div className="legend-item-left">
                                            <div className="legend-item-color" style={{ background: slice.color.startsWith('linear-gradient') ? slice.color.split(',')[1].trim() : slice.color }}></div>
                                            <span className="legend-item-label">{t('analytics.tier')} {slice.tier}</span>
                                        </div>
                                        <div className="legend-item-right">
                                            {slice.pct}% <span className="legend-item-mins">({Math.round(slice.mins)}m)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {pieChart.dfRatio >= 30 && (
                                <div className="pie-chart-warning">
                                    <strong>Warning:</strong> {t('analytics.pie_warning').replace('{pct}', String(pieChart.dfRatio))}
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
                        {t('analytics.study_graph')}
                    </h3>
                    <div className="timeline-controls">
                        <div className="timeline-stats-text">
                            {t('analytics.studied_summary')
                                .replace('{days}', String(timelineData.studiedDays))
                                .replace('{time}', formatTime(timelineData.totalPeriodMinutes))}
                        </div>
                        <select
                            value={timelineFilter}
                            onChange={e => setTimelineFilter(parseFloat(e.target.value))}
                            className="timeline-select"
                        >
                            {timelineOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
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
