import { useState, useRef, useEffect } from 'react';
import type { Subject, Tag } from '../lib/db';
import { daysSince, formatHM } from '../lib/time';
import { Pin, MoreVertical, Trash2, Pencil, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject, addChapter, deleteChapter, incrementStudyCount, type Chapter } from '../lib/chapters';

interface SubjectCardProps {
    subject: Subject;
    tags: Tag[];
    coverUrl: string | null;
    onDelete: () => void;
    onTogglePin: () => void;
    onEdit: () => void;
}

/** Sample average luminance from an image data URL using a small canvas */
function getImageLuminance(src: string): Promise<number> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 32; // sample at low res for speed
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            let total = 0;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
                // Relative luminance (perceived brightness)
                total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                count++;
            }
            resolve(total / count / 255); // 0 = black, 1 = white
        };
        img.onerror = () => resolve(0.5);
        img.src = src;
    });
}

export default function SubjectCard({ subject, tags, coverUrl, onDelete, onTogglePin, onEdit }: SubjectCardProps) {
    const { theme } = useSettings();
    const days = daysSince(subject.last_studied_at);
    const isNever = days === null;
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isDarkImage, setIsDarkImage] = useState(true);
    const [chaptersExpanded, setChaptersExpanded] = useState(false);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [newChapterName, setNewChapterName] = useState('');

    // Compute luminance when coverUrl changes
    useEffect(() => {
        if (!coverUrl) {
            setIsDarkImage(true);
            return;
        }
        getImageLuminance(coverUrl).then(lum => {
            setIsDarkImage(lum < 0.75);
        });
    }, [coverUrl]);

    // Load chapters
    useEffect(() => {
        setChapters(getChaptersForSubject(subject.id));
    }, [subject.id]);

    // Close menu on click outside
    useEffect(() => {
        if (!menuOpen) return;
        function handler(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const handleAddChapter = () => {
        if (!newChapterName.trim()) return;
        const ch = addChapter(subject.id, newChapterName.trim());
        setChapters([...chapters, ch]);
        setNewChapterName('');
        playSFX('checklist_sound', theme);
    };

    const handleDeleteChapter = (id: string) => {
        deleteChapter(id);
        setChapters(chapters.filter(c => c.id !== id));
    };

    const handleStudyChapter = (id: string) => {
        incrementStudyCount(id);
        setChapters(getChaptersForSubject(subject.id));
        playSFX('checklist_sound', theme);
    };

    const hasCover = !!coverUrl;
    const textColor = hasCover
        ? (isDarkImage ? '#ffffff' : 'var(--text-dark)')
        : undefined;

    return (
        <div className={`subject-card glass ${subject.pinned ? 'pinned' : ''}`} onMouseEnter={() => playSFX('hover_sound', theme)}>
            {coverUrl && (
                <div className="cover-image" style={{ backgroundImage: `url(${coverUrl})` }}>
                    <div className="cover-overlay"></div>
                </div>
            )}
            <div className="card-content" style={textColor ? { color: textColor } : undefined}>
                <div className="card-header">
                    <h3 className="subject-name" style={textColor ? { color: textColor } : undefined}>{subject.name}</h3>
                    <div style={{ position: 'relative' }} ref={menuRef}>
                        <button
                            className="btn-icon"
                            onClick={() => setMenuOpen(!menuOpen)}
                            style={hasCover ? { color: textColor } : undefined}
                        >
                            <MoreVertical size={18} />
                        </button>
                        {menuOpen && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                background: 'var(--card-bg, #fff)',
                                borderRadius: '12px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                padding: '6px 0',
                                minWidth: '160px',
                                zIndex: 100,
                                overflow: 'hidden'
                            }}>
                                <button
                                    onClick={() => { onEdit(); setMenuOpen(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        width: '100%', padding: '10px 16px', border: 'none',
                                        background: 'none', cursor: 'pointer', fontSize: '0.9rem',
                                        color: 'var(--text-dark)'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => { onTogglePin(); setMenuOpen(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        width: '100%', padding: '10px 16px', border: 'none',
                                        background: 'none', cursor: 'pointer', fontSize: '0.9rem',
                                        color: 'var(--text-dark)'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    <Pin size={14} /> {subject.pinned ? 'Unpin' : 'Pin'}
                                </button>
                                <button
                                    onClick={() => { onDelete(); setMenuOpen(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        width: '100%', padding: '10px 16px', border: 'none',
                                        background: 'none', cursor: 'pointer', fontSize: '0.9rem',
                                        color: 'var(--danger)'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="tags-container">
                    {tags.slice(0, 2).map((t) => (
                        <span key={t.id} className="tag">{t.name}</span>
                    ))}
                    {tags.length > 2 && <span className="tag-more">+{tags.length - 2}</span>}
                </div>

                <div className="card-stats">
                    <span className={`last-studied ${isNever ? 'never' : ''}`}>
                        {isNever ? 'Never studied' : `Last studied: ${days}d ago`}
                    </span>
                    <span className="total-time">Total: {formatHM(subject.total_minutes)}</span>
                </div>

                {/* Chapters Section */}
                <div style={{ marginTop: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setChaptersExpanded(!chaptersExpanded); }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '0.8rem', color: textColor || 'var(--text-muted)',
                            padding: '4px 0',
                        }}
                    >
                        {chaptersExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Chapters ({chapters.length})
                    </button>

                    {chaptersExpanded && (
                        <div style={{ marginTop: '8px', paddingLeft: '4px' }}>
                            {chapters.map(ch => (
                                <div key={ch.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '6px 8px', marginBottom: '4px',
                                    background: 'rgba(0,0,0,0.04)', borderRadius: '8px',
                                    fontSize: '0.82rem',
                                }}>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                                    {/* Study count dots */}
                                    <div style={{ display: 'flex', gap: '3px' }}>
                                        {[0, 1, 2].map(i => (
                                            <div key={i} style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                background: i < ch.studyCount ? 'var(--success)' : 'rgba(0,0,0,0.1)',
                                                transition: 'background 0.2s',
                                            }} />
                                        ))}
                                    </div>
                                    {ch.studyCount < 3 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStudyChapter(ch.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 4px' }}
                                            title="Mark as studied"
                                        >
                                            +1
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteChapter(ch.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                                        title="Delete chapter"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {/* Add chapter input */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                <input
                                    type="text"
                                    placeholder="New chapter..."
                                    value={newChapterName}
                                    onChange={e => setNewChapterName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddChapter(); }}
                                    onClick={e => e.stopPropagation()}
                                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
                                />
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleAddChapter(); }}
                                    style={{
                                        background: 'var(--primary)', color: '#fff', border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', padding: '4px 8px',
                                        display: 'flex', alignItems: 'center',
                                    }}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {subject.pinned && <Pin className="pin-icon" size={16} />}
            </div>
        </div>
    );
}
