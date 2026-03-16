import React, { useState, useEffect, useRef } from 'react';
import { useCountUp } from '../lib/useCountUp';
import { CalendarDays, Clock, CheckCircle, Lightbulb, Pen, ArrowUp, ArrowDown, X, BookOpen, Trash2, RotateCcw, Timer, Zap, Star, TrendingUp, Target } from 'lucide-react';
import type { Subject, Tag, Session, SessionBlock } from '../lib/db';
import { getSubjects, getSubjectTags, softDeleteSubject, updateSubjectPin, getSessions, getAllSessionBlocks, getTrashedSubjects, restoreSubject, permanentlyDeleteSubject, getMetacognitionLogs } from '../lib/db';
import CalendarPanel from '../components/CalendarPanel';
import WeeklyCompass from '../components/WeeklyCompass';
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import SubjectCard from '../components/SubjectCard';
import SubjectEditorModal from '../components/SubjectEditorModal';
import MetacognitionMode from '../components/MetacognitionMode';
import { useSettings } from '../lib/settings';
import { useTranslation } from '../lib/i18n';
import { TECHNIQUES } from '../lib/techniques';
import TechniquePickerModal from '../components/TechniquePickerModal';
import { CustomSelect } from '../components/CustomSelect';
import { playSFX } from '../lib/sounds';
import { getRecommendations, getAllChapters, type Recommendation, type Chapter } from '../lib/chapters';
import './Home.css';

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Monday = start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Convert a Uint8Array to a base64 data URL */
function toDataUrl(bytes: Uint8Array, ext: string): string {
    const mime =
        ext === 'png' ? 'image/png'
            : ext === 'gif' ? 'image/gif'
                : ext === 'webp' ? 'image/webp'
                    : 'image/jpeg';
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return `data:${mime};base64,${btoa(binary)}`;
}

function formatTimeStat(mins: number): string {
    if (mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface InsightItem {
    icon: React.ReactNode;
    value: string;
    label: string;
}

function RotatingInsightCard({ items }: { items: InsightItem[] }) {
    const [idx, setIdx] = useState(0);
    const [visible, setVisible] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (items.length <= 1) return;
        timerRef.current = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setIdx(i => (i + 1) % items.length);
                setVisible(true);
            }, 280);
        }, 3000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [items.length]);

    const item = items[idx] ?? items[0];
    return (
        <div className="stat-card glass rotating-insight-card">
            <div className={`rotating-insight-content${visible ? ' ri-visible' : ' ri-hidden'}`}>
                <div className="stat-icon">{item.icon}</div>
                <div className="stat-value-sm">{item.value}</div>
                <div className="stat-label">{item.label}</div>
            </div>
            <div className="rotating-insight-dots">
                {items.map((_, i) => (
                    <span key={i} className={`ri-dot${i === idx ? ' active' : ''}`} />
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    const [subjects, setSubjects] = useState<(Subject & { tags: Tag[] })[]>([]);
    const [tagFilter, setTagFilter] = useState<string>('All');
    const [subjectFilter, setSubjectFilter] = useState<string>('All');
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<(Subject & { tags: Tag[] }) | undefined>(undefined);
    const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
    const [sessions, setSessions] = useState<Session[]>([]);
    const [blocks, setBlocks] = useState<SessionBlock[]>([]);
    const [allChapters, setAllChapters] = useState<Chapter[]>([]);
    const [showTrash, setShowTrash] = useState(false);
    const [trashedSubjects, setTrashedSubjects] = useState<Subject[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [softDeleteToast, setSoftDeleteToast] = useState<{ id: string; name: string } | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [sortBy, setSortBy] = useState<string>('lastStudied');
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [showArchived, setShowArchived] = useState<boolean>(false);

    const { weekStart, theme } = useSettings();
    const { t } = useTranslation();
    const [showMetacognition, setShowMetacognition] = useState(false);
    const [showTechniqueModal, setShowTechniqueModal] = useState(false);
    const [weeklyStats, setWeeklyStats] = useState({ focusTime: 0, sessions: 0, activeDays: 0 });
    const [monthlyStats, setMonthlyStats] = useState({ focusTime: 0, sessions: 0, activeDays: 0, daysInMonth: 30 });
    const [monthlyInsights, setMonthlyInsights] = useState({ avgSessionMins: 0, longestSessionMins: 0, bestDay: '—', topSubject: '—', deepWorkPct: 0 });
    const [streaks, setStreaks] = useState({ current: 0, best: 0 });
    const [freeTimePercent, setFreeTimePercent] = useState<number | null>(null);

    const animFocusTime = useCountUp(weeklyStats.focusTime);
    const animSessions = useCountUp(weeklyStats.sessions);
    const animActiveDays = useCountUp(weeklyStats.activeDays);
    const animMonthFocus = useCountUp(monthlyStats.focusTime);
    const animMonthSessions = useCountUp(monthlyStats.sessions);
    const animMonthDays = useCountUp(monthlyStats.activeDays);
    const animCurrentStreak = useCountUp(streaks.current);
    const animBestStreak = useCountUp(streaks.best);
    const animFreeTime = useCountUp(freeTimePercent ?? 0, 1200);
    const [techniqueOfWeek, setTechniqueOfWeek] = useState<string | null>(() => localStorage.getItem('study-buddy-technique-week'));
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [ignoredRecs, setIgnoredRecs] = useState<Set<string>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem('study-buddy-ignored-recs') || '[]')); }
        catch { return new Set(); }
    });

    const ignoreRec = (chapterId: string) => {
        const next = new Set(ignoredRecs).add(chapterId);
        setIgnoredRecs(next);
        localStorage.setItem('study-buddy-ignored-recs', JSON.stringify([...next]));
    };



    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const checkMetacognitionMode = () => {
            const today = new Date();
            const day = today.getDay();
            const isEndOfWeek = weekStart === 'monday'
                ? (day === 5 || day === 6 || day === 0)
                : (day === 4 || day === 5 || day === 6);

            if (!isEndOfWeek) {
                setShowMetacognition(false);
                return;
            }

            const d = new Date(today);
            const currentDay = d.getDay();
            const diff = weekStart === 'monday'
                ? d.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
                : d.getDate() - currentDay;
            const sow = new Date(d.setDate(diff));
            sow.setHours(0, 0, 0, 0);

            const lastRecordedStr = localStorage.getItem('study-buddy-metacognition-last');
            if (!lastRecordedStr) {
                setShowMetacognition(true);
                return;
            }

            const lastRecorded = new Date(lastRecordedStr);
            setShowMetacognition(lastRecorded < sow);
        };

        checkMetacognitionMode();
    }, [weekStart]);

    async function loadData() {
        try {
            const subs = await getSubjects();
            const withTags = await Promise.all(subs.map(async s => {
                const t = await getSubjectTags(s.id);
                return { ...s, tags: t };
            }));

            // Extract unique tags for filter
            const tagsMap = new Map();
            withTags.forEach(s => s.tags.forEach(t => tagsMap.set(t.id, t)));
            setAllTags(Array.from(tagsMap.values()));

            setSubjects(withTags);

            // Load cover images as data URLs
            const urls: Record<string, string> = {};
            await Promise.all(withTags.map(async (s) => {
                if (!s.cover_path) return;
                try {
                    const bytes = await readFile(s.cover_path, { baseDir: BaseDirectory.AppData });
                    const ext = s.cover_path.split('.').pop()?.toLowerCase() || 'jpg';
                    urls[s.id] = toDataUrl(bytes, ext);
                } catch (err) {
                    console.warn(`Failed to load cover for "${s.name}":`, err);
                }
            }));
            setCoverUrls(urls);

            // Load sessions and blocks
            const [fetchedSessions, fetchedBlocks] = await Promise.all([getSessions(), getAllSessionBlocks()]);
            setSessions(fetchedSessions);
            setBlocks(fetchedBlocks);
            setAllChapters(getAllChapters());

            // Compute Weekly Stats
            const d = new Date(new Date());
            const currentDay = d.getDay();
            const diff = weekStart === 'monday'
                ? d.getDate() - currentDay + (currentDay === 0 ? -6 : 1)
                : d.getDate() - currentDay;
            const sow = new Date(d.setDate(diff));
            sow.setHours(0, 0, 0, 0);

            let weeklyFocus = 0;
            let weeklySessCount = 0;
            const activeDaysSet = new Set<string>();

            fetchedSessions.forEach(s => {
                const sd = new Date(s.started_at);
                if (sd >= sow) {
                    weeklyFocus += (s.actual_minutes || 0);
                    weeklySessCount++;
                    activeDaysSet.add(sd.toDateString());
                }
            });

            setWeeklyStats({
                focusTime: weeklyFocus,
                sessions: weeklySessCount,
                activeDays: activeDaysSet.size
            });

            // Compute Monthly Stats
            const now = new Date();
            const som = new Date(now.getFullYear(), now.getMonth(), 1);
            som.setHours(0, 0, 0, 0);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

            let monthlyFocus = 0;
            let monthlySessCount = 0;
            const monthlyDaysSet = new Set<string>();

            fetchedSessions.forEach(s => {
                const sd = new Date(s.started_at);
                if (sd >= som) {
                    monthlyFocus += (s.actual_minutes || 0);
                    monthlySessCount++;
                    monthlyDaysSet.add(sd.toDateString());
                }
            });

            setMonthlyStats({
                focusTime: monthlyFocus,
                sessions: monthlySessCount,
                activeDays: monthlyDaysSet.size,
                daysInMonth,
            });

            // Compute Streaks
            const streakDates = new Set<string>();
            fetchedSessions.forEach(s => {
                if ((s.actual_minutes || 0) > 0) streakDates.add(new Date(s.started_at).toDateString());
            });
            const sortedDates = Array.from(streakDates).sort();
            let streakCur = 0, streakBest = 0;
            if (sortedDates.length > 0) {
                let cur = 1, best = 1;
                let lastD = new Date(sortedDates[0]);
                for (let i = 1; i < sortedDates.length; i++) {
                    const d = new Date(sortedDates[i]);
                    const diff = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(lastD.getFullYear(), lastD.getMonth(), lastD.getDate())) / 86400000);
                    if (diff === 1) { cur++; if (cur > best) best = cur; }
                    else if (diff > 1) { cur = 1; }
                    lastD = d;
                }
                const today = new Date();
                const lastDate = new Date(sortedDates[sortedDates.length - 1]);
                const diffToToday = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())) / 86400000);
                if (diffToToday > 1) cur = 0;
                streakCur = cur;
                streakBest = Math.max(cur, best);
            }
            setStreaks({ current: streakCur, best: streakBest });

            // Compute Free Time Utilization
            const metacogLogs = await getMetacognitionLogs();
            const validLog = metacogLogs.find(log => log.free_time_hours != null && log.free_time_hours > 0);
            if (validLog && validLog.free_time_hours != null) {
                const logWeekStart = getWeekStart(new Date(validLog.created_at));
                const logWeekEnd = new Date(logWeekStart);
                logWeekEnd.setDate(logWeekEnd.getDate() + 7);
                const actualMins = fetchedSessions
                    .filter(s => {
                        const sd = new Date(s.started_at);
                        return sd >= logWeekStart && sd < logWeekEnd;
                    })
                    .reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
                const actualHours = actualMins / 60;
                setFreeTimePercent(Math.round((actualHours / validLog.free_time_hours) * 100));
            } else {
                setFreeTimePercent(null);
            }

            // Compute Monthly Insights
            const monthSessionIds = new Set(
                fetchedSessions.filter(s => new Date(s.started_at) >= som).map(s => s.id)
            );
            const monthBlocks = fetchedBlocks.filter(b => monthSessionIds.has(b.session_id));

            const avgSessionMins = monthlySessCount > 0 ? Math.round(monthlyFocus / monthlySessCount) : 0;

            const longestSessionMins = fetchedSessions
                .filter(s => new Date(s.started_at) >= som)
                .reduce((max, s) => Math.max(max, s.actual_minutes || 0), 0);

            const dayFocusMap: Record<string, number> = {};
            fetchedSessions.filter(s => new Date(s.started_at) >= som).forEach(s => {
                const day = new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'short' });
                dayFocusMap[day] = (dayFocusMap[day] || 0) + (s.actual_minutes || 0);
            });
            const bestDay = Object.entries(dayFocusMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

            const subjectFocusMap: Record<string, number> = {};
            monthBlocks.filter(b => b.type === 'focus' && b.subject_id).forEach(b => {
                subjectFocusMap[b.subject_id!] = (subjectFocusMap[b.subject_id!] || 0) + b.minutes;
            });
            const topSubjectId = Object.entries(subjectFocusMap).sort((a, b) => b[1] - a[1])[0]?.[0];
            const topSubject = subs.find(s => s.id === topSubjectId)?.name ?? '—';

            const focusBlocksMins = monthBlocks.filter(b => b.type === 'focus' && b.technique_id);
            const totalFocusMins = focusBlocksMins.reduce((s, b) => s + b.minutes, 0);
            const deepMins = focusBlocksMins
                .filter(b => { const t = TECHNIQUES.find(t => t.id === b.technique_id); return t?.tier === 'S' || t?.tier === 'A'; })
                .reduce((s, b) => s + b.minutes, 0);
            const deepWorkPct = totalFocusMins > 0 ? Math.round((deepMins / totalFocusMins) * 100) : 0;

            setMonthlyInsights({ avgSessionMins, longestSessionMins, bestDay, topSubject, deepWorkPct });

            // Load chapter recommendations
            const subjectNames: Record<string, string> = {};
            subs.forEach(s => { subjectNames[s.id] = s.name; });
            setRecommendations(getRecommendations(subjectNames));

        } catch (e) {
            console.error(e);
        }
    }

    // Filter and Sort (Shopping Style)
    const sortedAndFilteredSubjects = [...subjects]
        .filter(s => {
            if (!showArchived && s.archived) return false;
            const matchesTag = tagFilter === 'All' || s.tags.some(t => t.id === tagFilter);
            const matchesSubject = subjectFilter === 'All' || s.id === subjectFilter;
            return matchesTag && matchesSubject;
        })
        .sort((a, b) => {
            // Pinned logic (can adjust if always bottom or follow sort)
            // Sticking to bottom-pinned as original
            if (a.pinned !== b.pinned) return a.pinned ? 1 : -1;

            let valA, valB;
            if (sortBy === 'name') {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            } else if (sortBy === 'mostStudied') {
                valA = a.total_minutes || 0;
                valB = b.total_minutes || 0;
            } else { // lastStudied
                valA = a.last_studied_at ? new Date(a.last_studied_at).getTime() : 0;
                valB = b.last_studied_at ? new Date(b.last_studied_at).getTime() : 0;
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

    async function handleDelete(id: string) {
        playSFX('cancelling', theme);
        const subject = subjects.find(s => s.id === id);
        await softDeleteSubject(id);
        loadData();
        if (subject) {
            setSoftDeleteToast({ id, name: subject.name });
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setSoftDeleteToast(null), 5000);
        }
    }

    async function handleTogglePin(id: string, pinned: boolean) {
        await updateSubjectPin(id, !pinned);
        loadData();
    }

    function handleEdit(subject: Subject & { tags: Tag[] }) {
        setEditingSubject(subject);
        setIsEditorOpen(true);
    }

    function handleCloseEditor() {
        setIsEditorOpen(false);
        setEditingSubject(undefined);
    }

    function handleNewSubject() {
        setEditingSubject(undefined);
        setIsEditorOpen(true);
    }

    const handleMetacognitionComplete = () => {
        localStorage.setItem('study-buddy-metacognition-last', new Date().toISOString());
        setShowMetacognition(false);
    };

    if (showMetacognition) {
        return (
            <div className="home-page fade-in">
                <MetacognitionMode onComplete={handleMetacognitionComplete} />
            </div>
        );
    }

    return (
        <div className="home-page fade-in">
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-blue"><BookOpen size={20} /></div>
                    <h1 className="page-header-title">{t('home.dashboard')}</h1>
                </div>
            </div>

            <div className="dashboard-top-row">
                <div className="stats-containers-group">
                <div className="weekly-stats-container glass">
                    <h3>{t('home.active_week')}</h3>
                    <div className="weekly-stats-grid">
                        <div className="stat-card glass">
                            <Clock size={24} className="stat-icon" />
                            <div className="stat-value">{animFocusTime >= 60 ? `${Math.floor(animFocusTime / 60)}h ${animFocusTime % 60}m` : `${animFocusTime}m`}</div>
                            <div className="stat-label">{t('home.focus_time')}</div>
                        </div>
                        <div className="stat-card glass">
                            <CheckCircle size={24} className="stat-icon" />
                            <div className="stat-value">{animSessions}</div>
                            <div className="stat-label">{t('home.sessions')}</div>
                        </div>
                        <div className="stat-card glass">
                            <CalendarDays size={24} className="stat-icon" />
                            <div className="stat-value">{animActiveDays}/7</div>
                            <div className="stat-label">{t('home.active_days')}</div>
                        </div>
                        <div className={`stat-card glass technique-card-hover${!techniqueOfWeek ? ' technique-unset' : ''}`}
                            onMouseEnter={() => playSFX('hover_sound', theme)}
                        >
                            <Lightbulb size={24} className="stat-icon" />
                            <div className="stat-value-sm">
                                {techniqueOfWeek ? (TECHNIQUES.find(t => t.id === techniqueOfWeek)?.name || 'None') : '—'}
                            </div>
                            <div className="stat-label-technique">{t('home.tech_of_week')}</div>
                            <div className="stat-card-edit-mask" onClick={() => setShowTechniqueModal(true)}>
                                <Pen size={28} color="white" />
                            </div>
                        </div>
                        <div className="stat-card glass stat-card-full">
                            <Target size={24} className="stat-icon" />
                            <div className="stat-value">{freeTimePercent !== null ? `${animFreeTime}%` : '—'}</div>
                            <div className="stat-label">{t('home.free_time_used')}</div>
                        </div>
                    </div>
                </div>

                <div className="weekly-stats-container glass">
                    <h3>{t('home.active_month')}</h3>
                    <div className="weekly-stats-grid">
                        <div className="stat-card glass">
                            <Clock size={24} className="stat-icon" />
                            <div className="stat-value">{animMonthFocus >= 60 ? `${Math.floor(animMonthFocus / 60)}h ${animMonthFocus % 60}m` : `${animMonthFocus}m`}</div>
                            <div className="stat-label">{t('home.focus_time')}</div>
                        </div>
                        <div className="stat-card glass">
                            <CheckCircle size={24} className="stat-icon" />
                            <div className="stat-value">{animMonthSessions}</div>
                            <div className="stat-label">{t('home.sessions')}</div>
                        </div>
                        <div className="stat-card glass">
                            <CalendarDays size={24} className="stat-icon" />
                            <div className="stat-value">{animMonthDays}/{monthlyStats.daysInMonth}</div>
                            <div className="stat-label">{t('home.active_days')}</div>
                        </div>
                        <RotatingInsightCard items={[
                            { icon: <Clock size={24} className="stat-icon" />, value: formatTimeStat(monthlyInsights.avgSessionMins), label: t('home.avg_session') },
                            { icon: <Timer size={24} className="stat-icon" />, value: formatTimeStat(monthlyInsights.longestSessionMins), label: t('home.longest_session') },
                            { icon: <CalendarDays size={24} className="stat-icon" />, value: monthlyInsights.bestDay, label: t('home.best_day') },
                            { icon: <BookOpen size={24} className="stat-icon" />, value: monthlyInsights.topSubject, label: t('home.top_subject') },
                            { icon: <Zap size={24} className="stat-icon" />, value: monthlyInsights.deepWorkPct > 0 ? `${monthlyInsights.deepWorkPct}%` : '—', label: t('home.deep_work') },
                        ]} />
                    </div>
                </div>

                <div className="weekly-stats-container streaks-container glass">
                    <h3>{t('home.streaks')}</h3>
                    <div className="weekly-stats-grid">
                        <div className="stat-card glass streak-current">
                            <TrendingUp size={24} className="stat-icon" />
                            <div className="stat-value">{animCurrentStreak}</div>
                            <div className="stat-label">{t('home.current')}</div>
                        </div>
                        <div className="stat-card glass streak-best">
                            <Star size={24} className="stat-icon" />
                            <div className="stat-value">{animBestStreak}</div>
                            <div className="stat-label">{t('home.best')}</div>
                        </div>
                    </div>
                </div>
                </div>

                <CalendarPanel
                    sessions={sessions}
                    blocks={blocks}
                    subjects={subjects}
                    allChapters={allChapters}
                    weeklyActiveDays={weeklyStats.activeDays}
                />
            </div>

            <WeeklyCompass />

            <div className="shopping-filter-bar glass">
                <div className="filter-actions">
                    <div className="filter-group-inline">
                        <label>{t('home.tag')}:</label>
                        <CustomSelect
                            value={tagFilter}
                            onChange={val => setTagFilter(val)}
                            options={[
                                { value: "All", label: t('home.all_tags') },
                                ...allTags.map(t => ({ value: t.id, label: t.name }))
                            ]}
                        />
                    </div>
                    <div className="filter-group-inline">
                        <label>{t('home.subject')}:</label>
                        <CustomSelect
                            value={subjectFilter}
                            onChange={val => setSubjectFilter(val)}
                            options={[
                                { value: "All", label: t('home.all_subjects') },
                                ...subjects.map(s => ({ value: s.id, label: s.name }))
                            ]}
                        />
                    </div>
                    <div className="filter-group-inline">
                        <label className="archived-checkbox">
                            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                            {t('home.archived')}
                        </label>
                    </div>
                </div>

                <div className="sort-actions">
                    <label>{t('home.sort_by')}:</label>
                    <CustomSelect
                        value={sortBy}
                        onChange={val => setSortBy(val)}
                        options={[
                            { value: "lastStudied", label: t('home.last_studied') },
                            { value: "name", label: t('home.name') },
                            { value: "mostStudied", label: t('home.most_studied') }
                        ]}
                    />
                    <button
                        className="btn btn-secondary s-toggle-btn"
                        onClick={() => setSortAsc(!sortAsc)}
                        title={sortAsc ? t('home.ascending') : t('home.descending')}
                    >
                        {sortAsc ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={async () => {
                            const trashed = await getTrashedSubjects();
                            setTrashedSubjects(trashed);
                            setShowTrash(true);
                        }}
                    >
                        <Trash2 size={15} /> {t('home.trash')}
                    </button>
                </div>
            </div>

            {showTechniqueModal && (
                <TechniquePickerModal
                    currentSelection={techniqueOfWeek}
                    onClose={() => setShowTechniqueModal(false)}
                    onSelect={(id) => {
                        setTechniqueOfWeek(id);
                        localStorage.setItem('study-buddy-technique-week', id);
                    }}
                />
            )}

            {/* Recommendation of the Day */}
            {recommendations.filter(r => !ignoredRecs.has(r.chapter.id)).length > 0 && (
                <div className="glass recommendations-container">
                    <h3 className="recommendations-header">
                        <BookOpen size={18} /> {t('home.rec_of_day')}
                    </h3>
                    <p className="recommendations-desc">{t('home.rec_desc')}</p>
                    <div className="recommendations-list">
                        {recommendations.filter(r => !ignoredRecs.has(r.chapter.id)).map(rec => (
                            <div key={rec.chapter.id} className={`recommendation-card ${rec.daysOverdue > 3 ? 'danger' : 'warning'}`}>
                                <button className="recommendation-ignore-btn" onClick={() => ignoreRec(rec.chapter.id)} title="Ignore">
                                    <X size={13} />
                                </button>
                                <div className="recommendation-name">{rec.chapter.name}</div>
                                <div className="recommendation-subject">{rec.subjectName}</div>
                                <div className="recommendation-footer">
                                    <span className="recommendation-count">{t('home.study_number')}{rec.chapter.studyCount + 1}</span>
                                    {rec.daysOverdue > 0 && <span className="recommendation-overdue">({rec.daysOverdue}{t('home.overdue')})</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="dashboard-grid">
                <div className="subjects-grid">
                    {sortedAndFilteredSubjects.map(s => (
                        <SubjectCard
                            key={s.id}
                            subject={s}
                            tags={s.tags}
                            coverUrl={coverUrls[s.id] || null}
                            onDelete={() => handleDelete(s.id)}
                            onTogglePin={() => handleTogglePin(s.id, s.pinned)}
                            onClick={() => handleEdit(s)}
                        />
                    ))}

                    <button className="add-subject-card" onClick={handleNewSubject}>
                        {t('home.new_subject')}
                    </button>
                </div>
            </div>

            {isEditorOpen && (
                <SubjectEditorModal
                    onClose={handleCloseEditor}
                    onSaved={loadData}
                    editingSubject={editingSubject}
                />
            )}

            {softDeleteToast && (
                <div className="soft-delete-toast glass" role="status" aria-live="polite">
                    <span>{t('home.moved_to_trash')}</span>
                    <button
                        className="btn btn-secondary trash-toast-undo-btn"
                        onClick={async () => {
                            await restoreSubject(softDeleteToast.id);
                            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                            setSoftDeleteToast(null);
                            loadData();
                        }}
                    >
                        {t('home.restore')}
                    </button>
                    <button className="btn-icon" onClick={() => setSoftDeleteToast(null)} aria-label={t('home.cancel')}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {showTrash && (
                <div className="modal-overlay" onClick={() => setShowTrash(false)}>
                    <div className="modal-content log-modal-content" role="dialog" aria-modal="true" aria-labelledby="trash-modal-title" onClick={e => e.stopPropagation()}>
                        <div className="log-modal-header">
                            <h2 id="trash-modal-title" className="trash-modal-title-row">
                                <Trash2 size={20} /> {t('home.trash_modal_title')}
                            </h2>
                            <button className="btn btn-icon" onClick={() => setShowTrash(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {trashedSubjects.length === 0 ? (
                            <p className="text-muted text-center trash-modal-empty">{t('home.trash_empty')}</p>
                        ) : (
                            <div className="log-modal-list">
                                {trashedSubjects.map(s => (
                                    <div key={s.id} className="glass log-modal-item">
                                        <div className="trash-item-info">
                                            <div className="log-modal-subject">{s.name}</div>
                                            <div className="trash-item-date">
                                                {t('home.deleted_on')} {new Date(s.deleted_at!).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                                            </div>
                                        </div>
                                        <div className="trash-item-actions">
                                            <button
                                                className="btn btn-secondary trash-action-btn"
                                                title={t('home.restore')}
                                                onClick={async () => {
                                                    await restoreSubject(s.id);
                                                    const trashed = await getTrashedSubjects();
                                                    setTrashedSubjects(trashed);
                                                    loadData();
                                                }}
                                            >
                                                <RotateCcw size={13} /> {t('home.restore')}
                                            </button>
                                            {confirmDeleteId === s.id ? (
                                                <>
                                                    <span className="trash-confirm-text">{t('home.confirm')}</span>
                                                    <button
                                                        className="btn trash-delete-btn"
                                                        onClick={async () => {
                                                            playSFX('cancelling', theme);
                                                            await permanentlyDeleteSubject(s.id);
                                                            setConfirmDeleteId(null);
                                                            const trashed = await getTrashedSubjects();
                                                            setTrashedSubjects(trashed);
                                                        }}
                                                    >
                                                        <Trash2 size={13} /> {t('home.yes_delete')}
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary trash-action-btn"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                    >
                                                        {t('home.cancel')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="btn trash-delete-btn"
                                                    title={t('home.delete_permanently')}
                                                    onClick={() => setConfirmDeleteId(s.id)}
                                                >
                                                    <Trash2 size={13} /> {t('home.delete_permanently')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
