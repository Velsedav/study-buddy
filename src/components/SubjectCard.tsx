import { useState, useEffect } from 'react';
import type { Subject, Tag } from '../lib/db';
import { daysSince, formatHM } from '../lib/time';
import { Pin, Trash2 } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject } from '../lib/chapters';

interface SubjectCardProps {
    subject: Subject;
    tags: Tag[];
    coverUrl: string | null;
    onDelete: () => void;
    onTogglePin: () => void;
    onClick: () => void;
}

/** Sample average luminance from an image data URL using a small canvas */
function getImageLuminance(src: string): Promise<number> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 32;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            let total = 0;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
                total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                count++;
            }
            resolve(total / count / 255);
        };
        img.onerror = () => resolve(0.5);
        img.src = src;
    });
}

export default function SubjectCard({ subject, tags, coverUrl, onDelete, onTogglePin, onClick }: SubjectCardProps) {
    const { theme, isTerminal } = useSettings();
    const days = daysSince(subject.last_studied_at);
    const isNever = days === null;
    const [isDarkImage, setIsDarkImage] = useState(true);
    const [chapterCount, setChapterCount] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (!coverUrl) { setIsDarkImage(true); return; }
        getImageLuminance(coverUrl).then(lum => setIsDarkImage(lum < 0.75));
    }, [coverUrl]);

    useEffect(() => {
        setChapterCount(getChaptersForSubject(subject.id).length);
    }, [subject.id]);

    const hasCover = !!coverUrl;
    const textColor = hasCover
        ? (isTerminal ? 'var(--primary)' : (isDarkImage ? '#ffffff' : 'var(--text-dark)'))
        : undefined;

    return (
        <div
            className={`subject-card glass ${subject.pinned ? 'pinned' : ''} ${subject.archived ? 'archived' : ''}`}
            style={{ opacity: subject.archived ? 0.6 : 1, cursor: 'pointer', position: 'relative' }}
            onMouseEnter={() => { setIsHovered(true); playSFX('hover_sound', theme); }}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            {/* Hover action icons */}
            {isHovered && (
                <div style={{
                    position: 'absolute', top: '8px', right: '8px', zIndex: 10,
                    display: 'flex', gap: '6px',
                }}>
                    <button
                        className="btn-icon"
                        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                        title={subject.pinned ? 'Unpin' : 'Pin'}
                        style={{
                            background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: subject.pinned ? 'var(--accent)' : '#fff', border: 'none', cursor: 'pointer',
                            transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <Pin size={16} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        title="Delete"
                        style={{
                            background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--danger)', border: 'none', cursor: 'pointer',
                            transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            {coverUrl && (
                <div className="cover-image" style={{ backgroundImage: `url(${coverUrl})` }}>
                    <div className="cover-overlay"></div>
                </div>
            )}
            <div className="card-content" style={textColor ? { color: textColor } : undefined}>
                <div className="card-header" style={{ paddingRight: '24px' }}>
                    <h3 className="subject-name" style={{ wordBreak: 'break-word', flex: 1, ...(textColor ? { color: textColor } : {}) }}>{subject.name}</h3>
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

                {subject.deadline && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '6px', fontWeight: 'bold' }}>
                        {isTerminal ? '[!]' : '⏳'} Deadline: {new Date(subject.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                )}

                {/* Compact chapter count */}
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: textColor || 'var(--text-muted)' }}>
                    {isTerminal ? '>>' : '📖'} {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
                </div>

                {subject.pinned && <Pin className="pin-icon" size={16} />}
            </div>
        </div>
    );
}
