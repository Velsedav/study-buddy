import { useState, useEffect } from 'react';
import { CalendarDays, Clock, CheckCircle, Lightbulb, Pen, ArrowUp, ArrowDown, X, BookOpen, Trash2, RotateCcw } from 'lucide-react';
import type { Subject, Tag, Session, SessionBlock } from '../lib/db';
import { getSubjects, getSubjectTags, softDeleteSubject, updateSubjectPin, getSessions, getAllSessionBlocks, getTrashedSubjects, restoreSubject, permanentlyDeleteSubject } from '../lib/db';
import CalendarPanel from '../components/CalendarPanel';
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
    const [sessions, setSessions] = useState<Session[]>([]);
    const [blocks, setBlocks] = useState<SessionBlock[]>([]);
    const [allChapters, setAllChapters] = useState<Chapter[]>([]);
    const [showTrash, setShowTrash] = useState(false);
    const [trashedSubjects, setTrashedSubjects] = useState<Subject[]>([]);
    const [sortBy, setSortBy] = useState<string>('lastStudied');
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [showArchived, setShowArchived] = useState<boolean>(false);

    const { weekStart, theme } = useSettings();
    const { t } = useTranslation();
    const [showMetacognition, setShowMetacognition] = useState(false);
    const [showTechniqueModal, setShowTechniqueModal] = useState(false);
    const [weeklyStats, setWeeklyStats] = useState({ focusTime: 0, sessions: 0, activeDays: 0 });
    const [techniqueOfWeek, setTechniqueOfWeek] = useState(() => localStorage.getItem('study-buddy-technique-week') || 't1');
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);



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
        await softDeleteSubject(id);
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
                <div className="page-header-controls">
                    <h1 className="page-header-title">{t('home.dashboard')}</h1>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={async () => {
                            const trashed = await getTrashedSubjects();
                            setTrashedSubjects(trashed);
                            setShowTrash(true);
                        }}
                    >
                        <Trash2 size={15} /> Trash
                    </button>
                </div>
            </div>

            <div className="dashboard-top-row">
                <div className="weekly-stats-container glass">
                    <h3>Active Week</h3>
                    <div className="weekly-stats-grid">
                        <div className="stat-card glass">
                            <Clock size={24} className="stat-icon" />
                            <div className="stat-value">{weeklyStats.focusTime}m</div>
                            <div className="stat-label">Focus Time</div>
                        </div>
                        <div className="stat-card glass">
                            <CheckCircle size={24} className="stat-icon" />
                            <div className="stat-value">{weeklyStats.sessions}</div>
                            <div className="stat-label">Sessions</div>
                        </div>
                        <div className="stat-card glass">
                            <CalendarDays size={24} className="stat-icon" />
                            <div className="stat-value">{weeklyStats.activeDays}/7</div>
                            <div className="stat-label">Active Days</div>
                        </div>
                        <div className="stat-card glass technique-card-hover"
                            onMouseEnter={() => playSFX('hover_sound', theme)}
                        >
                            <Lightbulb size={24} className="stat-icon" />
                            <div className="stat-value-sm">
                                {TECHNIQUES.find(t => t.id === techniqueOfWeek)?.name || 'None'}
                            </div>
                            <div className="stat-label-technique">Tech. of Week</div>
                            <div className="stat-card-edit-mask" onClick={() => setShowTechniqueModal(true)}>
                                <Pen size={28} color="white" />
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
                            Archived
                        </label>
                    </div>
                </div>

                <div className="sort-actions">
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

            {/* Recommendation of the Day */}
            {recommendations.length > 0 && (
                <div className="glass recommendations-container">
                    <h3 className="recommendations-header">
                        <BookOpen size={18} /> Recommendation of the Day
                    </h3>
                    <p className="recommendations-desc">These chapters are due for review based on spaced repetition (1→3→5 day intervals).</p>
                    <div className="recommendations-list">
                        {recommendations.map(rec => (
                            <div key={rec.chapter.id} className={`recommendation-card ${rec.daysOverdue > 3 ? 'danger' : 'warning'}`}>
                                <div className="recommendation-name">{rec.chapter.name}</div>
                                <div className="recommendation-subject">{rec.subjectName}</div>
                                <div className="recommendation-footer">
                                    <span className="recommendation-count">{rec.chapter.studyCount}/3</span>
                                    {rec.daysOverdue > 0 && <span className="recommendation-overdue">({rec.daysOverdue}d overdue)</span>}
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

            {showTrash && (
                <div className="modal-overlay" onClick={() => setShowTrash(false)}>
                    <div className="modal-content log-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="log-modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Trash2 size={20} /> Corbeille
                            </h2>
                            <button className="btn btn-icon" onClick={() => setShowTrash(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {trashedSubjects.length === 0 ? (
                            <p className="text-muted text-center" style={{ padding: '24px 0' }}>La corbeille est vide.</p>
                        ) : (
                            <div className="log-modal-list">
                                {trashedSubjects.map(s => (
                                    <div key={s.id} className="glass log-modal-item" style={{ alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="log-modal-subject">{s.name}</div>
                                            <div className="log-modal-duration" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                Supprimé le {new Date(s.deleted_at!).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                title="Restaurer"
                                                onClick={async () => {
                                                    await restoreSubject(s.id);
                                                    const trashed = await getTrashedSubjects();
                                                    setTrashedSubjects(trashed);
                                                    loadData();
                                                }}
                                            >
                                                <RotateCcw size={13} /> Restaurer
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ padding: '5px 10px', fontSize: '0.8rem', color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                                                title="Supprimer définitivement"
                                                onClick={async () => {
                                                    await permanentlyDeleteSubject(s.id);
                                                    const trashed = await getTrashedSubjects();
                                                    setTrashedSubjects(trashed);
                                                }}
                                            >
                                                <Trash2 size={13} /> Supprimer
                                            </button>
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
