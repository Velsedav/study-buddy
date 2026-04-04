import { TECHNIQUES, getTierColor, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/techniques';
import type { TechCategory } from '../lib/techniques';
import { X, ExternalLink, ChevronRight } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { isDevMode } from '../lib/devMode';
import { useState, useEffect, useMemo } from 'react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { getSessions, getAllSessionBlocks } from '../lib/db';
import { useTranslation } from '../lib/i18n';
import './TechniquePickerModal.css';

interface TechniquePickerModalProps {
    onClose: () => void;
    onSelect: (techniqueId: string) => void;
    currentSelection: string | null;
    recommendedCategory?: TechCategory;
    suggestedTechniqueId?: string | null;
    suggestionLabel?: string | null;
    subjectName?: string | null;
    chapterName?: string | null;
}

const DAILY_LINK_KEY = 'study-buddy-technique-link-date';
const LEARNED_TECHS_KEY = 'study-buddy-learned-techs';
const WEEKLY_TECH_KEY = 'study-buddy-weekly-technique';

function hasClickedLinkToday(): boolean {
    const saved = localStorage.getItem(DAILY_LINK_KEY);
    if (!saved) return false;
    return saved === new Date().toISOString().split('T')[0];
}

function markLinkClicked() {
    localStorage.setItem(DAILY_LINK_KEY, new Date().toISOString().split('T')[0]);
}

function loadLearnedTechIds(): Set<string> {
    try {
        const saved = localStorage.getItem(LEARNED_TECHS_KEY);
        if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
}

export default function TechniquePickerModal({ onClose, onSelect, currentSelection, recommendedCategory, suggestedTechniqueId, suggestionLabel, subjectName, chapterName }: TechniquePickerModalProps) {
    const { theme } = useSettings();
    const { t } = useTranslation();
    const tiers = Array.from(new Set(TECHNIQUES.map(t => t.tier)));
    const suggestedTechniqueName = useMemo(
        () => TECHNIQUES.find(tech => tech.id === suggestedTechniqueId)?.name,
        [suggestedTechniqueId]
    );
    const [linkUsedToday, setLinkUsedToday] = useState(hasClickedLinkToday());
    const isLinkBlocked = linkUsedToday && !isDevMode();
    const [showBlockedTooltip, setShowBlockedTooltip] = useState<string | null>(null);
    const [learnedTechIds, setLearnedTechIds] = useState<Set<string>>(loadLearnedTechIds);
    const [justClickedTechId, setJustClickedTechId] = useState<string | null>(null);
    const [weeklyTechId, setWeeklyTechId] = useState<string | null>(() => localStorage.getItem(WEEKLY_TECH_KEY));
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

    const handleLinkClick = (url: string, techId: string) => {
        const alreadyLearned = learnedTechIds.has(techId);
        if (!alreadyLearned && isLinkBlocked) return;
        openExternal(url);
        setJustClickedTechId(techId);
        if (!alreadyLearned) {
            const next = new Set(learnedTechIds);
            next.add(techId);
            setLearnedTechIds(next);
            localStorage.setItem(LEARNED_TECHS_KEY, JSON.stringify([...next]));
            markLinkClicked();
            setLinkUsedToday(true);
        }
    };

    const handleSetWeeklyTech = (techId: string) => {
        localStorage.setItem(WEEKLY_TECH_KEY, techId);
        setWeeklyTechId(techId);
    };

    const renderLearnButton = (url: string, techId: string) => {
        const alreadyLearned = learnedTechIds.has(techId);
        const justClicked = justClickedTechId === techId;
        const isWeekly = weeklyTechId === techId;
        const blocked = !alreadyLearned && isLinkBlocked;

        if (justClicked) {
            return isWeekly ? (
                <button className="btn btn-secondary btn-is-weekly" disabled>
                    ⭐ Technique of the week!
                </button>
            ) : (
                <button
                    className="btn btn-primary btn-set-weekly"
                    onClick={(e) => { e.stopPropagation(); handleSetWeeklyTech(techId); }}
                >
                    ⭐ Set as Technique of the Week
                </button>
            );
        }

        if (alreadyLearned) {
            return (
                <button
                    className="btn-learnt-more"
                    onClick={(e) => { e.stopPropagation(); handleLinkClick(url, techId); }}
                >
                    <ExternalLink size={12} /> Learnt more
                </button>
            );
        }

        return (
            <div className="tech-link-tooltip-wrapper">
                <button
                    className={`btn btn-secondary btn-learn-more${blocked ? ' blocked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleLinkClick(url, techId); }}
                    onMouseEnter={() => { if (blocked) setShowBlockedTooltip(techId); }}
                    onMouseLeave={() => setShowBlockedTooltip(null)}
                >
                    <ExternalLink size={12} /> Learn more
                </button>
                {showBlockedTooltip === techId && blocked && (
                    <div className="tech-link-tooltip">
                        Let's not procrastinate more and just study right now, it has the highest return on investment
                        <div className="tech-link-tooltip-arrow" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content tech-picker-modal" role="dialog" aria-modal="true" aria-labelledby="tech-picker-title" onClick={e => e.stopPropagation()}>
                <div className="tech-picker-header">
                    <div className="tech-picker-header-left">
                        {(subjectName || chapterName) && (
                            <div className="tech-picker-breadcrumb" aria-label={t('plan.technique_breadcrumb_label')}>
                                {subjectName && (
                                    <span className="tech-breadcrumb-step tech-breadcrumb-done">{subjectName}</span>
                                )}
                                {subjectName && chapterName && (
                                    <ChevronRight size={12} className="tech-breadcrumb-sep" aria-hidden="true" />
                                )}
                                {chapterName && (
                                    <span className="tech-breadcrumb-step tech-breadcrumb-done">{chapterName}</span>
                                )}
                                <ChevronRight size={12} className="tech-breadcrumb-sep" aria-hidden="true" />
                                <span className="tech-breadcrumb-step tech-breadcrumb-active">{t('plan.technique_breadcrumb_current')}</span>
                            </div>
                        )}
                        <h2 id="tech-picker-title">{t('plan.select_technique')}</h2>
                    </div>
                    <button className="btn-icon tech-picker-close" aria-label={t('plan.close')} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {suggestionLabel && suggestedTechniqueId && (
                    <div className="tech-suggestion-banner">
                        <span className="tech-suggestion-label">{suggestionLabel}</span>
                        <button
                            className="btn btn-primary tech-suggestion-apply"
                            onClick={() => { onSelect(suggestedTechniqueId); onClose(); }}
                        >
                            {suggestedTechniqueName}
                        </button>
                    </div>
                )}

                <div className="tech-picker-scroll">
                    {tiers.map(tier => (
                        <div key={tier} className="tech-tier-group">
                            <h3
                                className="tech-tier-heading"
                                style={{ '--tier-color': getTierColor(tier as any) } as React.CSSProperties}
                            >
                                Tier {tier}
                                <div className="tech-tier-underline" />
                            </h3>
                            {dfRatio > 30 && (tier === 'D' || tier === 'E' || tier === 'F') && (
                                <div className="tech-df-warning">
                                    <strong>Warning:</strong> {dfRatio}% of your focus time is spent on D/F techniques. These are inefficient and create an illusion of competence. Consider Active Recall instead!
                                </div>
                            )}
                            <div className="tech-tier-techniques">
                                {TECHNIQUES.filter(t => t.tier === tier).map(t => {
                                    const isRecommended = recommendedCategory && t.category === recommendedCategory;
                                    const isSuggested = suggestedTechniqueId === t.id;
                                    return (
                                        <div
                                            key={t.id}
                                            className={`glass tech-card${currentSelection === t.id ? ' selected' : ''}${isRecommended ? ' recommended-technique' : ''}${isSuggested ? ' suggested-technique' : ''}`}
                                            onClick={() => { onSelect(t.id); onClose(); }}
                                            onMouseEnter={() => playSFX('glass_ui_hover', theme)}
                                        >
                                            <div className="tech-card-header">
                                                <span className="tech-card-name">{t.name}</span>
                                                {t.category && (
                                                    <span
                                                        className="tech-category-tag"
                                                        style={{ '--category-color': CATEGORY_COLORS[t.category] } as React.CSSProperties}
                                                    >
                                                        {CATEGORY_LABELS[t.category]}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="tech-card-summary">
                                                {t.advantage && (
                                                    <div className="tech-advantage-pill">✦ {t.advantage}</div>
                                                )}
                                                <div className="tech-learn-btn-group">
                                                    {renderLearnButton(
                                                        t.externalLink ?? 'https://notebooklm.google.com/notebook/33dc2ca6-a3da-4218-b679-bd91ce99d7e7',
                                                        t.id
                                                    )}
                                                </div>
                                            </div>
                                            <div className="tech-card-detail">
                                                <div className="tech-card-hint">{t.hint}</div>
                                            </div>
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
