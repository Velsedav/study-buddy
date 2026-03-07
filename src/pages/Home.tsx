import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Clock, CheckCircle, Lightbulb, Pen, ArrowUp, ArrowDown, ChevronRight, ChevronLeft, X, BookOpen } from 'lucide-react';
import type { Subject, Tag } from '../lib/db';
import { getSubjects, getSubjectTags, deleteSubject, updateSubjectPin, getSessions } from '../lib/db';
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
import { getRecommendations, type Recommendation } from '../lib/chapters';

const COMPLIMENTS = [
    { text: "You have an amazing ability to focus when you set your mind to it! 🌟", author: "A Friend" },
    { text: "Your dedication to your goals is truly inspiring. Keep going! 🚀", author: "Study Buddy" },
    { text: "You're doing better than you think you are. Be proud of your progress! 💖", author: "Inner Voice" },
    { text: "Your hard work today is building the foundation for your success tomorrow. 🏛️", author: "Mentor" },
    { text: "You always find a way to figure things out. You've got this! ✨", author: "Colleague" }
];

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

export default function Home() {
    const [subjects, setSubjects] = useState<(Subject & { tags: Tag[] })[]>([]);
    const [tagFilter, setTagFilter] = useState<string>('All');
    const [subjectFilter, setSubjectFilter] = useState<string>('All');
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<(Subject & { tags: Tag[] }) | undefined>(undefined);
    const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
    const [heatmapData, setHeatmapData] = useState<{ date: Date, intensity: number, tooltip: string, sessions?: any[] }[]>([]);
    const [sortBy, setSortBy] = useState<string>('lastStudied');
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [showArchived, setShowArchived] = useState<boolean>(false);

    // Heatmap Navigation & Logs
    const [currentHeatmapMonth, setCurrentHeatmapMonth] = useState(() => {
        const d = new Date();
        d.setDate(1); // Set to 1st of current month
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedLogDate, setSelectedLogDate] = useState<Date | null>(null);

    const { weekStart, theme } = useSettings();
    const { t } = useTranslation();
    const [showMetacognition, setShowMetacognition] = useState(false);
    const [showTechniqueModal, setShowTechniqueModal] = useState(false);
    const [weeklyStats, setWeeklyStats] = useState({ focusTime: 0, sessions: 0, activeDays: 0 });
    const [techniqueOfWeek, setTechniqueOfWeek] = useState(() => localStorage.getItem('study-buddy-technique-week') || 't1');
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

    // Compliment state
    const [complimentIdx, setComplimentIdx] = useState(() => Math.floor(Math.random() * COMPLIMENTS.length));

    useEffect(() => {
        loadData();
    }, [currentHeatmapMonth]);

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

            // Heatmap logic - Current Selected Month
            const fetchedSessions = await getSessions();

            const year = currentHeatmapMonth.getFullYear();
            const month = currentHeatmapMonth.getMonth();
            const startNodeDate = new Date(year, month, 1);
            const nextMonthDate = new Date(year, month + 1, 1);

            // Generate exact days in month
            const monthDays: Date[] = [];
            let itr = new Date(startNodeDate);
            while (itr < nextMonthDate) {
                monthDays.push(new Date(itr));
                itr.setDate(itr.getDate() + 1);
            }

            // Map intensities onto monthDays array
            const heatmap = monthDays.map(date => {
                const dateStr = date.toISOString().split('T')[0];
                const daySessions = fetchedSessions.filter(s => {
                    const sd = new Date(s.started_at);
                    return sd.toISOString().split('T')[0] === dateStr;
                });

                let dayMin = 0;
                daySessions.forEach(s => { if (s.actual_minutes) dayMin += s.actual_minutes });

                let intensity = 0;
                if (dayMin > 120) intensity = 4;
                else if (dayMin > 60) intensity = 3;
                else if (dayMin > 30) intensity = 2;
                else if (dayMin > 0) intensity = 1;

                let tooltip = date.toLocaleDateString();
                if (dayMin > 0) {
                    tooltip += ` - ${dayMin} minutes (${daySessions.length} sessions)`;
                } else {
                    tooltip += ' - No sessions';
                }

                return { date, intensity, tooltip, sessions: daySessions };
            });

            setHeatmapData(heatmap);

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

    // Filtering and Daily Logs Extractor
    const sessionsForSelectedDate = useMemo(() => {
        if (!selectedLogDate) return [];
        const targetStr = selectedLogDate.toISOString().split('T')[0];

        return (heatmapData.find(d => d.date.toISOString().split('T')[0] === targetStr)?.sessions || [])
            // Enjoin names securely via map
            .map(session => {
                const attachedSub = subjects.find(s => s.id === session.subject_id);
                return {
                    ...session,
                    subject_name: attachedSub ? attachedSub.name : 'Unknown Subject'
                };
            });
    }, [selectedLogDate, heatmapData, subjects]);

    async function handleDelete(id: string) {
        await deleteSubject(id);
        loadData();
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

    return (
        <div className="home-page" style={{ paddingBottom: '20vh' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h1>{t('home.dashboard')}</h1>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setShowMetacognition(true)}>
                        Trigger Metacognition
                    </button>
                </div>
            </div>

            {showMetacognition && (
                <MetacognitionMode onComplete={handleMetacognitionComplete} />
            )}

            <div className="dashboard-top-section" style={{ display: 'flex', gap: '64px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div className="heatmap-section glass" style={{ marginBottom: 0 }}>
                    {/* Heatmap Navigation Header */}
                    <div className="heatmap-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarDays size={20} className="icon-blue" />
                            {currentHeatmapMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn btn-icon glass"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => {
                                    setCurrentHeatmapMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                                    loadData();
                                }}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                className="btn btn-icon glass"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => {
                                    setCurrentHeatmapMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                                    loadData();
                                }}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem', marginTop: '-8px' }}>{t('home.heatmap_desc')}</p>
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
                                    {heatmapData.map((day, i) => {
                                        const isRainbow = day.intensity > 0 && weeklyStats.activeDays === 7;
                                        const isFlame = day.intensity > 0 && weeklyStats.activeDays >= 5 && weeklyStats.activeDays < 7;

                                        return (
                                            <div
                                                key={i}
                                                className={`heatmap-cell h-level-${day.intensity} ${isRainbow ? 'rainbow-pulse' : ''}`}
                                                title={day.tooltip}
                                                style={{ cursor: day.intensity > 0 ? 'pointer' : 'default' }}
                                                onClick={() => {
                                                    if (day.intensity > 0) setSelectedLogDate(day.date);
                                                }}
                                            >
                                                {day.date.getDate()}
                                                {isFlame && <span style={{ fontSize: '12px', pointerEvents: 'none', position: 'absolute', right: '4px', bottom: '2px' }}>🔥</span>}
                                                {isRainbow && <span style={{ fontSize: '12px', pointerEvents: 'none', position: 'absolute', right: '4px', bottom: '2px' }}>✨</span>}
                                            </div>
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </div>
                    <div className="heatmap-legend">
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('home.less')}</span>
                        <div className="heatmap-cell h-level-0"></div>
                        <div className="heatmap-cell h-level-1"></div>
                        <div className="heatmap-cell h-level-2"></div>
                        <div className="heatmap-cell h-level-3"></div>
                        <div className="heatmap-cell h-level-4"></div>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('home.more')}</span>
                    </div>
                </div>

                <div className="weekly-stats-container glass" style={{ width: '300px', flexShrink: 0, padding: '16px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Active Week</h3>
                    <div className="weekly-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
                        <div className="stat-card glass" style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={24} className="stat-icon" style={{ marginBottom: '8px' }} />
                            <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{weeklyStats.focusTime}m</div>
                            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Focus Time</div>
                        </div>
                        <div className="stat-card glass" style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={24} className="stat-icon" style={{ marginBottom: '8px' }} />
                            <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{weeklyStats.sessions}</div>
                            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Sessions</div>
                        </div>
                        <div className="stat-card glass" style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <CalendarDays size={24} className="stat-icon" style={{ marginBottom: '8px' }} />
                            <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{weeklyStats.activeDays}/7</div>
                            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Active Days</div>
                        </div>
                        <div className="stat-card glass technique-card-hover" style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
                            onMouseEnter={() => playSFX('hover_sound', theme)}
                        >
                            <Lightbulb size={24} className="stat-icon" style={{ marginBottom: '8px' }} />
                            <div className="stat-value" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent)', textAlign: 'center', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                                {TECHNIQUES.find(t => t.id === techniqueOfWeek)?.name || 'None'}
                            </div>
                            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>Tech. of Week</div>

                            <div className="stat-card-edit-mask" onClick={() => setShowTechniqueModal(true)}>
                                <Pen size={28} color="white" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="compliments-container glass"
                    style={{ flex: 1, minWidth: '250px', padding: '16px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                    onMouseEnter={() => playSFX('hover_sound', theme)}
                    onClick={() => setComplimentIdx((complimentIdx + 1) % COMPLIMENTS.length)}
                >
                    <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: 'var(--primary)' }}>Daily Compliment 🌸</h3>
                    <p style={{ fontStyle: 'italic', fontSize: '1rem', lineHeight: 1.5, marginBottom: '8px', color: 'var(--text-dark)' }}>
                        "{COMPLIMENTS[complimentIdx].text}"
                    </p>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        — {COMPLIMENTS[complimentIdx].author}
                    </div>
                </div>
            </div>

            <div className="shopping-filter-bar glass" style={{ maxWidth: '80%', margin: '0 auto 24px auto', position: 'relative', zIndex: 50, display: 'flex', justifyContent: 'space-between', padding: '16px', borderRadius: 'var(--border-radius)' }}>
                <div className="filter-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="filter-group-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    <div className="filter-group-inline" style={{ marginLeft: '8px' }}>
                        <label className="checkbox-label" style={{ margin: 0, fontWeight: 500, color: 'var(--text-dark)' }}>
                            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                            Archived
                        </label>
                    </div>
                </div>

                <div className="sort-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label>Sort By:</label>
                    <CustomSelect
                        value={sortBy}
                        onChange={val => setSortBy(val)}
                        options={[
                            { value: "lastStudied", label: "Last Studied" },
                            { value: "name", label: "Name" },
                            { value: "mostStudied", label: "Most Studied" }
                        ]}
                    />
                    <button
                        className="btn btn-secondary s-toggle-btn"
                        onClick={() => setSortAsc(!sortAsc)}
                        title={sortAsc ? "Ascending" : "Descending"}
                    >
                        {sortAsc ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
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
                                        <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{session.duration_minutes} min</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Recommendation of the Day */}
            {recommendations.length > 0 && (
                <div className="glass" style={{ maxWidth: '80%', margin: '0 auto 24px auto', padding: '20px', borderRadius: 'var(--border-radius)' }}>
                    <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                        <BookOpen size={18} /> Recommendation of the Day
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>These chapters are due for review based on spaced repetition (1→3→5 day intervals).</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {recommendations.map(rec => (
                            <div key={rec.chapter.id} style={{
                                padding: '12px 16px',
                                background: 'rgba(var(--primary-rgb), 0.08)',
                                borderRadius: '12px',
                                borderLeft: rec.daysOverdue > 3 ? '3px solid var(--danger)' : '3px solid var(--accent)',
                                minWidth: '200px',
                            }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{rec.chapter.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rec.subjectName}</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{rec.chapter.studyCount}/3</span>
                                    {rec.daysOverdue > 0 && <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>({rec.daysOverdue}d overdue)</span>}
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
                            onEdit={() => handleEdit(s)}
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
        </div>
    );
}
