import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getSubject, getSubjectTags } from '../lib/db';
import type { Subject, Tag } from '../lib/db';
import { getChaptersForSubject } from '../lib/chapters';
import type { Chapter } from '../lib/chapters';
import { ArrowLeft, BookOpen, Music, Tag as TagIcon, Calendar, TrendingUp } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import './SubjectDetail.css';

export default function SubjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [subject, setSubject] = useState<Subject | null>(null);
    const [tags, setTags] = useState<Tag[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        async function load() {
            try {
                const s = await getSubject(id!);
                if (s) {
                    setSubject(s);
                    const [t, c] = await Promise.all([
                        getSubjectTags(id!),
                        getChaptersForSubject(id!)
                    ]);
                    setTags(t);
                    setChapters(c);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    if (loading) return (
        <div className="subject-detail-page">
            <header className="subject-detail-header">
                <div className="skeleton subject-detail-skeleton-back" />
                <div className="subject-header-main">
                    <div className="skeleton subject-detail-skeleton-title" />
                    <div className="skeleton subject-detail-skeleton-tag" />
                </div>
            </header>
            <div className="subject-detail-grid">
                <div className="detail-section glass">
                    <div className="skeleton subject-detail-skeleton-heading" />
                    <div className="skeleton subject-detail-skeleton-stat" />
                    <div className="skeleton subject-detail-skeleton-stat" />
                    <div className="skeleton subject-detail-skeleton-stat" />
                </div>
                <div className="detail-section glass">
                    <div className="skeleton subject-detail-skeleton-heading" />
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="skeleton subject-detail-skeleton-row" />
                    ))}
                </div>
            </div>
        </div>
    );
    if (!subject) return <div className="subject-detail-error">Subject not found.</div>;

    const isMusic = subject.subject_type === 'music';
    const mainChapters = chapters.filter(c => !/^\s+[A-Z]\./.test(c.name));
    const pieceCount = isMusic ? mainChapters.filter(c => c.totalMeasures && c.totalMeasures > 0).length : 0;
    const skillCount = isMusic ? mainChapters.filter(c => !c.totalMeasures || c.totalMeasures === 0).length : 0;

    return (
        <div className="subject-detail-page anim-enter">
            <header className="subject-detail-header">
                <button className="btn btn-icon back-btn" onClick={() => navigate('/')} title="Back to dashboard">
                    <ArrowLeft size={20} />
                </button>
                <div className="subject-header-main">
                    <div className="subject-title-row">
                        <h1>{subject.name}</h1>
                        {isMusic && <span className="type-badge music-badge"><Music size={14} /> {t('subject_editor.type_music')}</span>}
                    </div>
                    <div className="subject-meta-row">
                        {tags.map(tag => (
                            <span key={tag.id} className="detail-tag-chip">
                                <TagIcon size={12} /> {tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            <div className="subject-detail-grid">
                <section className="detail-section stats-section glass">
                    <h2><TrendingUp size={18} /> Stats</h2>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <label>Total Study Time</label>
                            <span className="stat-value">{subject.total_minutes}m</span>
                        </div>
                        {subject.deadline && (
                            <div className="stat-item">
                                <label><Calendar size={14} /> Deadline</label>
                                <span className="stat-value">{new Date(subject.deadline).toLocaleDateString()}</span>
                            </div>
                        )}
                        <div className="stat-item">
                            <label>{isMusic ? 'Pieces / Skills' : 'Chapters'}</label>
                            <span className="stat-value">{isMusic ? `${pieceCount} / ${skillCount}` : chapters.length}</span>
                        </div>
                    </div>
                </section>

                <section className="detail-section content-section glass">
                    <h2>
                        {isMusic ? <><Music size={18} /> Pieces & Skills</> : <><BookOpen size={18} /> Chapters</>}
                    </h2>
                    
                    <div className="detail-chapter-list">
                        {chapters.length === 0 ? (
                            <p className="empty-text">No {isMusic ? 'pieces' : 'chapters'} added yet.</p>
                        ) : (
                            chapters.map(c => {
                                const isSkill = isMusic && (!c.totalMeasures || c.totalMeasures === 0);
                                return (
                                    <div key={c.id} className={`detail-chapter-item ${isSkill ? 'is-skill' : ''}`}>
                                        <div className="chapter-item-info">
                                            <span className="chapter-name">{c.name}</span>
                                            {isMusic && c.totalMeasures ? (
                                                <span className="chapter-measures">{c.totalMeasures} measures</span>
                                            ) : null}
                                        </div>
                                        <div className="chapter-item-meta">
                                            <span className="study-count">{c.studyCount} studies</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
