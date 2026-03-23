import { useState, useEffect } from 'react';
import type { Subject, Tag } from '../lib/db';
import { daysSince, formatHM } from '../lib/time';
import { Pin, Trash2 } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject } from '../lib/chapters';
import './SubjectCard.css';

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

    // Compute synchronously on every render — avoids stale count when chapters are added
    // Sub-chapters (e.g. "  A. Ubuntu") are excluded from the main chapter count
    const allChapters = getChaptersForSubject(subject.id);
    const mainChapters = allChapters.filter(c => !/^\s+[A-Z]\./.test(c.name));
    const chapterCount = mainChapters.length;
    const isMusic = subject.subject_type === 'music';
    const pieceCount = isMusic ? mainChapters.filter(c => c.totalMeasures && c.totalMeasures > 0).length : 0;
    const skillCount = isMusic ? mainChapters.filter(c => !c.totalMeasures || c.totalMeasures === 0).length : 0;

    useEffect(() => {
        if (!coverUrl) { setIsDarkImage(true); return; }
        getImageLuminance(coverUrl).then(lum => setIsDarkImage(lum < 0.75));
    }, [coverUrl]);

    const hasCover = !!coverUrl;
    const textColor = hasCover
        ? (isTerminal ? 'var(--primary)' : (isDarkImage ? '#ffffff' : 'var(--text-dark)'))
        : null;

    return (
        <div
            className={`subject-card glass ${subject.pinned ? 'pinned' : ''} ${subject.archived ? 'archived' : ''}`}
            onMouseEnter={() => playSFX('glass_ui_hover', theme)}
            onClick={onClick}
        >
            {/* Hover action icons */}
            <div className="subject-card-actions">
                <button
                    className={`subject-card-action-btn${subject.pinned ? ' pinned' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                    title={subject.pinned ? 'Unpin' : 'Pin'}
                >
                    <Pin size={16} />
                </button>
                <button
                    className="subject-card-action-btn danger"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    title="Delete"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {coverUrl && (
                <div className="cover-image" style={{ backgroundImage: `url(${coverUrl})` }}>
                    <div className="cover-overlay"></div>
                </div>
            )}
            <div
                className={`card-content${textColor ? ' card-content-colored' : ''}`}
                style={textColor ? { '--card-text-color': textColor } as React.CSSProperties : undefined}
            >
                <div className="card-header">
                    <h3 className={`subject-name${textColor ? ' subject-name-colored' : ''}`}>{subject.name}</h3>
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
                    <div className="subject-card-deadline">
                        {isTerminal ? '[!]' : '⏳'} Deadline: {new Date(subject.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                )}

                <div className={`subject-card-chapter-count${textColor ? ' with-cover' : ''}`}>
                    {isMusic ? (
                        <>
                            {isTerminal ? '>>' : '🎵'} {pieceCount} morceau{pieceCount !== 1 ? 'x' : ''}
                            {skillCount > 0 && ` · ${skillCount} compétence${skillCount !== 1 ? 's' : ''}`}
                        </>
                    ) : (
                        <>{isTerminal ? '>>' : '📖'} {chapterCount} chapitre{chapterCount !== 1 ? 's' : ''}</>
                    )}
                </div>

                {subject.pinned && <Pin className="pin-icon" size={16} />}
            </div>
        </div>
    );
}
