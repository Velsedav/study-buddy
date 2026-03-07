import { X } from 'lucide-react';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject, FOCUS_TYPE_LABELS, FOCUS_TYPE_COLORS } from '../lib/chapters';
import { playSFX } from '../lib/sounds';

interface ChapterPickerModalProps {
    subjectId: string;
    onClose: () => void;
    onSelect: (chapterName: string) => void;
    currentSelection: string | null;
}

export default function ChapterPickerModal({ subjectId, onClose, onSelect, currentSelection }: ChapterPickerModalProps) {
    const { theme } = useSettings();
    const chapters = getChaptersForSubject(subjectId).sort((a, b) => a.studyCount - b.studyCount);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0 }}>Select a chapter</h2>
                    <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ overflowY: 'auto', paddingRight: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {chapters.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No chapters defined for this subject.
                        </div>
                    ) : (
                        chapters.map(ch => {
                            const isSelected = currentSelection === ch.name;
                            return (
                                <div
                                    key={ch.id}
                                    className={`glass ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                        onSelect(ch.name);
                                    }}
                                    onMouseEnter={() => playSFX('hover_sound', theme)}
                                    style={{
                                        padding: '16px',
                                        cursor: 'pointer',
                                        border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                                        transition: 'all 0.2s ease',
                                        borderRadius: 'var(--border-radius)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{ch.name}</span>
                                            {ch.focusType && (
                                                <span style={{
                                                    background: FOCUS_TYPE_COLORS[ch.focusType],
                                                    color: '#fff',
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    letterSpacing: '0.3px',
                                                }}>
                                                    {FOCUS_TYPE_LABELS[ch.focusType]}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[0, 1, 2].map(i => (
                                                <div key={i} style={{
                                                    width: '10px', height: '10px', borderRadius: '50%',
                                                    background: i < ch.studyCount ? 'var(--success)' : 'rgba(0,0,0,0.1)',
                                                }} />
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
