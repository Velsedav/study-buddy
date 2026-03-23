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
                            {t('chapter_picker.empty')}
                        </div>
                    ) : (
                        chapters.map(ch => {
                            const isSelected = currentSelection === ch.name;
                            const isRecommended = recommendedIds.has(ch.id);
                            const isSubChapter = /^\s+[A-Z]\./.test(ch.name);
                            const isPiece = (ch.totalMeasures ?? 0) > 0;
                            return (
                                <div
                                    key={ch.id}
                                    className={`glass chapter-picker-item${isSelected ? ' selected' : ''}${isRecommended ? ' recommendation-highlight recommended' : ''}${isSubChapter ? ' sub-chapter' : ''}${isPiece ? ' piece' : ''}`}
                                    onClick={() => { onSelect(ch.name); }}
                                    onMouseEnter={() => playSFX('glass_ui_hover', theme)}
                                >
                                    <div className="chapter-picker-item-header">
                                        <div className="chapter-picker-item-labels">
                                            <span className={`chapter-picker-item-name${isSubChapter ? ' sub-chapter' : ''}`}>{ch.name}</span>
                                            {isPiece && (
                                                <span className="chapter-picker-piece-badge">
                                                    🎵 {t('chapter_picker.piece_badge')}
                                                </span>
                                            )}
                                            {isRecommended && (
                                                <span className="recommendation-badge">
                                                    ✨ {t('chapter_picker.recommended')}
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
                                    {isPiece ? (
                                        <div className="chapter-picker-measure-row">
                                            <span className="chapter-picker-measure-label">
                                                {t('chapter_picker.measure_progress')
                                                    .replace('{current}', String(ch.currentMeasure ?? 0))
                                                    .replace('{total}', String(ch.totalMeasures))}
                                            </span>
                                            <div className="chapter-picker-measure-bar">
                                                <div
                                                    className="chapter-picker-measure-fill"
                                                    style={{ '--measure-pct': `${((ch.currentMeasure ?? 0) / ch.totalMeasures!) * 100}%` } as React.CSSProperties}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="chapter-picker-study-count">
                                            {(ch.studyCount === 1 ? t('chapter_picker.studied_once') : t('chapter_picker.studied_many'))
                                                .replace('{n}', String(ch.studyCount))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
