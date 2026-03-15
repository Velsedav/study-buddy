import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject, FOCUS_TYPE_LABELS, FOCUS_TYPE_COLORS, getRecommendations, type Recommendation } from '../lib/chapters';
import { playSFX } from '../lib/sounds';
import { useTranslation } from '../lib/i18n';
import './ChapterPickerModal.css';

interface ChapterPickerModalProps {
    subjectId: string;
    onClose: () => void;
    onSelect: (chapterName: string) => void;
    currentSelection: string | null;
}

export default function ChapterPickerModal({ subjectId, onClose, onSelect, currentSelection }: ChapterPickerModalProps) {
    const { theme } = useSettings();
    const { t } = useTranslation();
    const chapters = getChaptersForSubject(subjectId).sort((a, b) => a.studyCount - b.studyCount);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const recommendations = getRecommendations({});
    const ignoredRecs = (() => {
        try { return new Set(JSON.parse(localStorage.getItem('study-buddy-ignored-recs') || '[]')); }
        catch { return new Set(); }
    })();
    const recommendedIds = new Set(recommendations.filter((r: Recommendation) => !ignoredRecs.has(r.chapter.id)).map((r: Recommendation) => r.chapter.id));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content chapter-picker-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="chapter-picker-title"
                onClick={e => e.stopPropagation()}
            >
                <div className="chapter-picker-header">
                    <h2 id="chapter-picker-title">{t('chapter_picker.title')}</h2>
                    <button className="btn-icon" aria-label={t('chapter_picker.close')} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="chapter-picker-list">
                    {chapters.length === 0 ? (
                        <div className="chapter-picker-empty">
                            No chapters defined for this subject.
                        </div>
                    ) : (
                        chapters.map(ch => {
                            const isSelected = currentSelection === ch.name;
                            const isRecommended = recommendedIds.has(ch.id);
                            const isSubChapter = /^\s+[A-Z]\./.test(ch.name);
                            return (
                                <div
                                    key={ch.id}
                                    className={`glass chapter-picker-item${isSelected ? ' selected' : ''}${isRecommended ? ' recommendation-highlight recommended' : ''}${isSubChapter ? ' sub-chapter' : ''}`}
                                    onClick={() => { onSelect(ch.name); }}
                                    onMouseEnter={() => playSFX('hover_sound', theme)}
                                >
                                    <div className="chapter-picker-item-header">
                                        <div className="chapter-picker-item-labels">
                                            <span className={`chapter-picker-item-name${isSubChapter ? ' sub-chapter' : ''}`}>{ch.name}</span>
                                            {isRecommended && (
                                                <span className="recommendation-badge">
                                                    ✨ Recommended
                                                </span>
                                            )}
                                            {ch.focusType && (
                                                <span
                                                    className="chapter-picker-focus-badge"
                                                    style={{ '--badge-bg': FOCUS_TYPE_COLORS[ch.focusType] } as React.CSSProperties}
                                                >
                                                    {FOCUS_TYPE_LABELS[ch.focusType]}
                                                </span>
                                            )}
                                        </div>
                                        <div className="chapter-picker-dots">
                                            {[0, 1, 2].map(i => (
                                                <div key={i} className={`chapter-picker-dot${i < ch.studyCount ? ' filled' : ''}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="chapter-picker-study-count">
                                        Studied {ch.studyCount} {ch.studyCount === 1 ? 'time' : 'times'}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
