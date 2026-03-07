import { TECHNIQUES, getTierColor, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/techniques';
import type { TechCategory } from '../lib/techniques';
import { X, ExternalLink } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { useState, useEffect } from 'react';
import { getSessions, getAllSessionBlocks } from '../lib/db';

interface TechniquePickerModalProps {
    onClose: () => void;
    onSelect: (techniqueId: string) => void;
    currentSelection: string;
    recommendedCategory?: TechCategory;
}

const DAILY_LINK_KEY = 'study-buddy-technique-link-date';

function hasClickedLinkToday(): boolean {
    const saved = localStorage.getItem(DAILY_LINK_KEY);
    if (!saved) return false;
    return saved === new Date().toISOString().split('T')[0];
}

function markLinkClicked() {
    localStorage.setItem(DAILY_LINK_KEY, new Date().toISOString().split('T')[0]);
}

export default function TechniquePickerModal({ onClose, onSelect, currentSelection, recommendedCategory }: TechniquePickerModalProps) {
    const { theme } = useSettings();
    const tiers = Array.from(new Set(TECHNIQUES.map(t => t.tier)));
    const [linkUsedToday, setLinkUsedToday] = useState(hasClickedLinkToday());
    const [showBlockedTooltip, setShowBlockedTooltip] = useState<string | null>(null);
    const [dfRatio, setDfRatio] = useState<number>(0);

    useEffect(() => {
        async function fetchDfRatio() {
            try {
                const [sessions, blocks] = await Promise.all([getSessions(), getAllSessionBlocks()]);
                const validSessionIds = new Set(sessions.map(s => s.id));
                let total = 0;
                let df = 0;
                blocks.forEach(b => {
                    if (validSessionIds.has(b.session_id) && b.type === 'focus' && b.technique_id) {
                        const tech = TECHNIQUES.find(t => t.id === b.technique_id);
                        if (tech && tech.tier) {
                            total += b.minutes;
                            if (tech.tier === 'D' || tech.tier === 'E' || tech.tier === 'F') {
                                df += b.minutes;
                            }
                        }
                    }
                });
                if (total > 0) {
                    setDfRatio(Math.round((df / total) * 100));
                }
            } catch (e) {
                console.error("Failed to compute dfRatio", e);
            }
        }
        fetchDfRatio();
    }, []);

    const handleLinkClick = (url: string, _techId: string) => {
        if (linkUsedToday) return;
        markLinkClicked();
        setLinkUsedToday(true);
        window.open(url, '_blank');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0 }}>Select a technique</h2>
                    <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ overflowY: 'auto', paddingRight: '12px', flex: 1 }}>
                    <style>{`
                        @keyframes pulse-recommendation {
                            0% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 1); border-color: var(--primary); background: rgba(var(--primary-rgb), 0.2); }
                            50% { box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0.4); border-color: var(--primary-hover); background: rgba(var(--primary-rgb), 0.02); }
                            100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0); border-color: var(--primary); background: rgba(var(--primary-rgb), 0.2); }
                        }
                        .recommended-technique {
                            animation: pulse-recommendation 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
                            border: 2px solid var(--primary) !important;
                        }
                    `}</style>
                    {tiers.map(tier => (
                        <div key={tier} style={{ marginBottom: '24px' }}>
                            <h3 style={{ position: 'relative', paddingBottom: '8px', marginBottom: '16px', color: 'var(--text-dark)' }}>
                                Tier {tier}
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: getTierColor(tier as any) }} />
                            </h3>
                            {dfRatio > 30 && (tier === 'D' || tier === 'E' || tier === 'F') && (
                                <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(var(--danger-rgb), 0.1)', borderLeft: '3px solid var(--danger)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                                    <strong>Warning:</strong> {dfRatio}% of your focus time is spent on D/F techniques. These are inefficient and create an illusion of competence. Consider Active Recall instead!
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {TECHNIQUES.filter(t => t.tier === tier).map(t => {
                                    const isRecommended = recommendedCategory && t.category === recommendedCategory;
                                    return (
                                        <div
                                            key={t.id}
                                            className={`glass ${currentSelection === t.id ? 'selected' : ''} ${isRecommended ? 'recommended-technique' : ''}`}
                                            style={{
                                                padding: '16px',
                                                cursor: 'pointer',
                                                border: currentSelection === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                                                transition: 'border-color 0.2s',
                                                borderRadius: 'var(--border-radius)'
                                            }}
                                            onClick={() => {
                                                onSelect(t.id);
                                                onClose();
                                            }}
                                            onMouseEnter={() => playSFX('hover_sound', theme)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{t.name}</span>
                                                {/* Category tag */}
                                                {t.category && (
                                                    <span style={{
                                                        background: CATEGORY_COLORS[t.category],
                                                        color: '#fff',
                                                        padding: '2px 8px',
                                                        borderRadius: '10px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'bold',
                                                        letterSpacing: '0.3px',
                                                    }}>
                                                        {CATEGORY_LABELS[t.category]}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t.hint}</div>
                                            {/* Advantage pill */}
                                            {t.advantage && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    display: 'inline-block',
                                                    background: 'rgba(34, 197, 94, 0.12)',
                                                    color: '#16a34a',
                                                    padding: '4px 10px',
                                                    borderRadius: '10px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                }}>
                                                    ✦ {t.advantage}
                                                </div>
                                            )}
                                            {/* External link */}
                                            {t.externalLink && (
                                                <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{
                                                            padding: '3px 10px',
                                                            fontSize: '0.75rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            opacity: linkUsedToday ? 0.4 : 1,
                                                            cursor: linkUsedToday ? 'not-allowed' : 'pointer',
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!linkUsedToday) handleLinkClick(t.externalLink!, t.id);
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (linkUsedToday) setShowBlockedTooltip(t.id);
                                                        }}
                                                        onMouseLeave={() => setShowBlockedTooltip(null)}
                                                    >
                                                        <ExternalLink size={12} /> Learn more
                                                    </button>
                                                    {showBlockedTooltip === t.id && linkUsedToday && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            bottom: '130%',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            background: 'var(--text-dark)',
                                                            color: '#fff',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            whiteSpace: 'nowrap',
                                                            zIndex: 100,
                                                            maxWidth: '300px',
                                                            textAlign: 'center',
                                                            lineHeight: '1.3',
                                                            boxShadow: 'var(--shadow-md)',
                                                        }}>
                                                            Let's not procrastinate more and just study right now, it has the highest return on investment
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '-6px',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                width: 0,
                                                                height: 0,
                                                                borderLeft: '6px solid transparent',
                                                                borderRight: '6px solid transparent',
                                                                borderTop: '6px solid var(--text-dark)',
                                                            }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* All techniques fallback link */}
                                            {!t.externalLink && (
                                                <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{
                                                            padding: '3px 10px',
                                                            fontSize: '0.75rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            opacity: linkUsedToday ? 0.4 : 1,
                                                            cursor: linkUsedToday ? 'not-allowed' : 'pointer',
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!linkUsedToday) handleLinkClick('https://notebooklm.google.com/notebook/33dc2ca6-a3da-4218-b679-bd91ce99d7e7', t.id);
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (linkUsedToday) setShowBlockedTooltip(t.id);
                                                        }}
                                                        onMouseLeave={() => setShowBlockedTooltip(null)}
                                                    >
                                                        <ExternalLink size={12} /> Learn more
                                                    </button>
                                                    {showBlockedTooltip === t.id && linkUsedToday && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            bottom: '130%',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            background: 'var(--text-dark)',
                                                            color: '#fff',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            fontSize: '0.75rem',
                                                            whiteSpace: 'nowrap',
                                                            zIndex: 100,
                                                            maxWidth: '300px',
                                                            textAlign: 'center',
                                                            lineHeight: '1.3',
                                                            boxShadow: 'var(--shadow-md)',
                                                        }}>
                                                            Let's not procrastinate more and just study right now, it has the highest return on investment
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '-6px',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                width: 0,
                                                                height: 0,
                                                                borderLeft: '6px solid transparent',
                                                                borderRight: '6px solid transparent',
                                                                borderTop: '6px solid var(--text-dark)',
                                                            }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
