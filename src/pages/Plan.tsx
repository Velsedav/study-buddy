import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubjects, getMetacognitionLogs, getAllSubjectTagsMap, getAllTags, getBlockCountForChapter, getErrorLogEntries } from '../lib/db';
import type { Subject, Tag, ErrorLogEntry } from '../lib/db';
import { useUndoRedo } from '../lib/undo';
import TechniquePickerModal from '../components/TechniquePickerModal';
import ChapterPickerModal from '../components/ChapterPickerModal';
import WeeklyCompass from '../components/WeeklyCompass';
import { TECHNIQUES, type TechCategory } from '../lib/techniques';
import { ChevronDown, MoreVertical, Calendar, GripVertical, Undo2, Redo2, Zap, Bell, BellOff } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { useTranslation } from '../lib/i18n';
import { getChaptersForSubject, getAllChapters } from '../lib/chapters';
import './Plan.css';

type BlockType = 'PREP' | 'WORK' | 'BREAK';

interface Block {
    id: string;
    type: BlockType;
    minutes: number;
    subject_id: string | null;
    technique_id: string | null;
    chapter_name?: string | null;
    objective: string;
    cycle_id?: string;
}

const TEMPLATES: Record<string, { work: number, break: number, prep: number }> = {
    '10/5': { work: 10, break: 5, prep: 5 },
    '15/5': { work: 15, break: 5, prep: 5 },
    '25/5': { work: 25, break: 5, prep: 10 },
    '47/13': { work: 47, break: 13, prep: 10 },
    '50/10': { work: 50, break: 10, prep: 10 },
    '90/20': { work: 90, break: 20, prep: 10 },
    'Custom': { work: 25, break: 5, prep: 5 }
};

const PIXELS_PER_MINUTE = 16;

interface FlyingSubject {
    id: string;
    name: string;
    fromX: number;
    fromY: number;
    dx: number;
    dy: number;
}

export default function Plan() {
    const navigate = useNavigate();
    const { theme, isTerminal } = useSettings();
    const { t } = useTranslation();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [subjectTagsMap, setSubjectTagsMap] = useState<Map<string, string[]>>(new Map());
    const [planTagFilter, setPlanTagFilter] = useState<string | null>(null);
    const [tagFilterOpen, setTagFilterOpen] = useState(false);
    const [tagFilterQuery, setTagFilterQuery] = useState('');
    const [tagFilterHighlight, setTagFilterHighlight] = useState(0);
    const tagFilterRef = useRef<HTMLDivElement>(null);
    const tagFilterListRef = useRef<HTMLDivElement>(null);
    const [fiveMinAlert, setFiveMinAlert] = useState(() => localStorage.getItem('study-buddy-five-min-alert') !== 'false');
    const [prioritySubjectIds, setPrioritySubjectIds] = useState<Set<string>>(new Set());
    const [template, setTemplate] = useState('25/5');
    const [customWork, setCustomWork] = useState(25);
    const [customBreak, setCustomBreak] = useState(5);
    const [customPrep, setCustomPrep] = useState(5);
    const [repeats, setRepeats] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [isMouseDownOnSubject, setIsMouseDownOnSubject] = useState(false);
    const [draggingSubjectId, setDraggingSubjectId] = useState<string | null>(null);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    const { present: blocks, set: setBlocks, undo, canUndo, redo, canRedo } = useUndoRedo<Block[]>([]);

    const [pickingBlockId, setPickingBlockId] = useState<string | null>(null);
    const [pickingChapterBlockId, setPickingChapterBlockId] = useState<string | null>(null);
    const [suggestedTechniqueId, setSuggestedTechniqueId] = useState<string | null>(null);
    const [suggestionLabel, setSuggestionLabel] = useState<string | null>(null);
    const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
    const [openMenuBlockId, setOpenMenuBlockId] = useState<string | null>(null);
    const [landedBlockIds, setLandedBlockIds] = useState<Set<string>>(new Set());
    const [flyingSubject, setFlyingSubject] = useState<FlyingSubject | null>(null);
    const [errorLogEntries, setErrorLogEntries] = useState<ErrorLogEntry[]>([]);

    const dragRef = useRef<{ id: string, startY: number, startBlocks: Block[], lastDeltaSteps: number } | null>(null);

    const handleResizeStart = (e: React.MouseEvent, blockId: string) => {
        e.stopPropagation();
        dragRef.current = { id: blockId, startY: e.clientY, startBlocks: [...blocks], lastDeltaSteps: 0 };
        setResizingBlockId(blockId);
        document.body.style.cursor = 'grabbing';

        const pixelsPerStep = PIXELS_PER_MINUTE * 5; // 25 px per 5 minutes

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!dragRef.current) return;
            const { id, startY, startBlocks, lastDeltaSteps } = dragRef.current;
            const deltaY = moveEvent.clientY - startY;

            // Calendar snap step
            const deltaSteps = Math.round(deltaY / pixelsPerStep);
            const deltaMinutes = deltaSteps * 5;

            if (deltaMinutes === 0) {
                setBlocks([...startBlocks]);
                return;
            }

            const idx = startBlocks.findIndex(b => b.id === id);
            if (idx === -1) return;

            if (deltaSteps !== lastDeltaSteps) {
                if (deltaSteps > lastDeltaSteps) {
                    import('../lib/sounds').then(m => m.playSFX('glass_ui_drag_down', theme));
                } else {
                    import('../lib/sounds').then(m => m.playSFX('glass_ui_drag_up', theme));
                }
                dragRef.current.lastDeltaSteps = deltaSteps;
            }

            const originalBlock = startBlocks[idx];
            let newMinutes = originalBlock.minutes + deltaMinutes;

            // Cannot be less than 5 minutes
            if (newMinutes < 5) newMinutes = 5;

            // Cap growth at what adjacent WORK blocks can give up
            // Empty blocks can be fully absorbed; filled blocks keep a 5-min minimum
            if (newMinutes > originalBlock.minutes) {
                let availableToAbsorb = 0;
                for (let i = idx + 1; i < startBlocks.length; i++) {
                    const next = startBlocks[i];
                    if (next.type !== 'WORK') break;
                    if (!next.subject_id) {
                        availableToAbsorb += next.minutes;
                    } else {
                        availableToAbsorb += Math.max(0, next.minutes - 5);
                        break; // only look at the first filled block
                    }
                }
                if (newMinutes > originalBlock.minutes + availableToAbsorb) {
                    newMinutes = originalBlock.minutes + availableToAbsorb;
                }
            }

            const actualDelta = newMinutes - originalBlock.minutes;
            if (actualDelta === 0) {
                setBlocks([...startBlocks]);
                return;
            }

            const newBlocks = [...startBlocks];
            newBlocks[idx] = { ...originalBlock, minutes: newMinutes };

            if (actualDelta < 0) {
                // Shrinking: give time to the next WORK block (empty or filled)
                const deficit = Math.abs(actualDelta);
                if (idx + 1 < newBlocks.length && newBlocks[idx + 1].type === 'WORK') {
                    newBlocks[idx + 1] = { ...newBlocks[idx + 1], minutes: newBlocks[idx + 1].minutes + deficit };
                } else {
                    newBlocks.splice(idx + 1, 0, {
                        id: crypto.randomUUID(),
                        type: 'WORK',
                        minutes: deficit,
                        subject_id: null,
                        technique_id: null,
                        objective: '',
                        cycle_id: originalBlock.cycle_id
                    });
                }
            } else if (actualDelta > 0) {
                // Growing: steal from adjacent WORK blocks
                let remainingToAbsorb = actualDelta;
                const indicesToRemove: number[] = [];

                for (let i = idx + 1; i < newBlocks.length && remainingToAbsorb > 0; i++) {
                    const next = newBlocks[i];
                    if (next.type !== 'WORK') break;

                    if (!next.subject_id) {
                        // Empty block: can be fully absorbed
                        if (next.minutes > remainingToAbsorb) {
                            newBlocks[i] = { ...next, minutes: next.minutes - remainingToAbsorb };
                            remainingToAbsorb = 0;
                        } else {
                            remainingToAbsorb -= next.minutes;
                            indicesToRemove.push(i);
                        }
                    } else {
                        // Filled block: steal down to 5 min minimum, then stop
                        const steal = Math.min(next.minutes - 5, remainingToAbsorb);
                        if (steal > 0) {
                            newBlocks[i] = { ...next, minutes: next.minutes - steal };
                            remainingToAbsorb -= steal;
                        }
                        break;
                    }
                }

                for (const i of indicesToRemove.reverse()) {
                    newBlocks.splice(i, 1);
                }
            }

            setBlocks(newBlocks);
        };

        const onMouseUp = () => {
            dragRef.current = null;
            setResizingBlockId(null);
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    useEffect(() => {
        getSubjects().then(subs => {
            // sort unpinned first, then pinned
            setSubjects(subs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? 1 : -1)));
        });
        getAllTags().then(tags => setAllTags(tags));
        getAllSubjectTagsMap().then(map => setSubjectTagsMap(map));
        getErrorLogEntries().then(entries => setErrorLogEntries(entries.filter(e => !e.resolved)));
        getMetacognitionLogs().then(logs => {
            const latest = logs[0];
            if (latest?.priority_subject_ids) {
                try {
                    const parsed = JSON.parse(latest.priority_subject_ids);
                    if (Array.isArray(parsed)) {
                        const selectedIds = new Set(parsed.map((p: unknown) =>
                            typeof p === 'string' ? p : (p as { id: string }).id
                        ));
                        // Also mark parent subjects of any selected chapters
                        const allChapters = getAllChapters();
                        allChapters.forEach(c => {
                            if (selectedIds.has(c.id)) selectedIds.add(c.subjectId);
                        });
                        setPrioritySubjectIds(selectedIds);
                    }
                } catch { /* ignore parse errors */ }
            }
        });
    }, []);

    // Removed auto-generate blocks on template/repeat change
    const addBlocks = () => {
        const tConfig = template === 'Custom'
            ? { work: customWork, break: customBreak, prep: customPrep }
            : TEMPLATES[template] || TEMPLATES['25/5'];

        const newBlocks: Block[] = [...blocks];

        // Find if we need a PREP block at the very beginning (only if blocks is empty)
        if (blocks.length === 0 && tConfig.prep > 0) {
            newBlocks.push({ id: crypto.randomUUID(), type: 'PREP', minutes: tConfig.prep, subject_id: null, technique_id: null, objective: '' });
        }

        for (let i = 0; i < repeats; i++) {
            const cycleId = crypto.randomUUID();
            newBlocks.push({ id: crypto.randomUUID(), type: 'WORK', minutes: tConfig.work, subject_id: null, technique_id: null, objective: '', cycle_id: cycleId });

            // Don't add a trailing break if it's the very last item overall, but do add it between repeats
            if (i < repeats - 1) {
                newBlocks.push({ id: crypto.randomUUID(), type: 'BREAK', minutes: tConfig.break, subject_id: null, technique_id: null, objective: '' });
            }
        }

        // If we already had blocks, we should add a break before appending the new work blocks
        if (blocks.length > 0) {
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock.type === 'WORK') {
                newBlocks.splice(blocks.length, 0, { id: crypto.randomUUID(), type: 'BREAK', minutes: tConfig.break, subject_id: null, technique_id: null, objective: '' });
            }
        }

        import('../lib/sounds').then(m => m.playSFX('glass_ui_drop', 'glassmorphism'));
        setBlocks(newBlocks);
    };

    // Handle Drag / Drop for Subjects
    const handleDragStart = (e: React.DragEvent, subjectId: string) => {
        e.dataTransfer.setData('subjectId', subjectId);
        setIsDragging(true);
        setDraggingSubjectId(subjectId);

        // Custom drag ghost — bright visible pill instead of browser's semi-transparent snapshot
        const subject = subjects.find(s => s.id === subjectId);
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost-pill';
        ghost.textContent = subject?.name || '';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
        setTimeout(() => { if (document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        setIsMouseDownOnSubject(false);
        setDraggingSubjectId(null);
        setHoveredBlockId(null);
    };

    const handleSubjectMouseDown = (subjectId: string) => {
        setIsMouseDownOnSubject(true);
        setDraggingSubjectId(subjectId);

        const handleMouseUp = () => {
            setIsMouseDownOnSubject(false);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleDrop = (e: React.DragEvent, blockId: string) => {
        e.preventDefault();
        const subjectId = e.dataTransfer.getData('subjectId');
        if (!subjectId) return;

        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, subject_id: subjectId } : b);
        import('../lib/sounds').then(m => m.playSFX('glass_ui_drop', 'glassmorphism'));
        setBlocks(newBlocks);

        // Flying subject pill: from cursor drop position → block center
        const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
        const toRect = blockEl?.getBoundingClientRect();
        const subject = subjects.find(s => s.id === subjectId);
        if (toRect && subject) {
            const fromX = e.clientX;
            const fromY = e.clientY;
            const toX = toRect.left + toRect.width / 2;
            const toY = toRect.top + toRect.height / 2;
            setFlyingSubject({ id: crypto.randomUUID(), name: subject.name, fromX, fromY, dx: toX - fromX, dy: toY - fromY });
            setTimeout(() => setFlyingSubject(null), 400);
        }

        // Block squish triggers when the pill "arrives" (~82% of 350ms flight = 287ms)
        setTimeout(() => {
            setLandedBlockIds(prev => new Set(prev).add(blockId));
            setTimeout(() => {
                setLandedBlockIds(prev => { const next = new Set(prev); next.delete(blockId); return next; });
            }, 350);
        }, 285);

        // Delay modal until after flying animation completes
        const subjectChapters = getChaptersForSubject(subjectId);
        setTimeout(() => {
            if (subjectChapters.length > 0) {
                setPickingChapterBlockId(blockId);
            } else {
                setPickingBlockId(blockId);
            }
        }, 380);

        setHoveredBlockId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleBlockDragEnter = (blockId: string) => {
        setHoveredBlockId(blockId);
    };

    const handleBlockDragLeave = () => {
        setHoveredBlockId(null);
    };

    const handleTechniqueSelected = (techId: string, objective: string) => {
        if (!pickingBlockId) return;
        const newBlocks = blocks.map(b => {
            if (b.id === pickingBlockId) {
                return { ...b, technique_id: techId, objective: objective || b.objective };
            }
            return b;
        });
        setBlocks(newBlocks);
        setPickingBlockId(null);
    };

    const clearBlock = (id: string) => {
        import('../lib/sounds').then(m => m.playSFX('glass_ui_cancel', 'glassmorphism'));
        setBlocks(blocks.map(b => b.id === id ? { ...b, subject_id: null, technique_id: null, chapter_name: null, objective: '' } : b));
    };

    const handleChapterSelectedModal = async (chapterName: string) => {
        const block = blocks.find(b => b.id === pickingChapterBlockId);
        let autoObjective = '';
        if (block?.subject_id) {
            const chapter = getChaptersForSubject(block.subject_id).find(c => c.name === chapterName);
            if (chapter?.totalMeasures && chapter.totalMeasures > 0) {
                const from = (chapter.currentMeasure ?? 0) + 1;
                const to = Math.min(from + 7, chapter.totalMeasures);
                autoObjective = `Mesures ${from}–${to}`;
            }
        }
        setBlocks(blocks.map(b => b.id === pickingChapterBlockId
            ? { ...b, chapter_name: chapterName, objective: autoObjective }
            : b
        ));

        // Compute technique suggestion based on how many times this chapter has been worked
        let nextSuggestedId: string | null = null;
        let nextSuggestionLabel: string | null = null;
        if (block?.subject_id) {
            const dbCount = await getBlockCountForChapter(block.subject_id, chapterName);
            const planCount = blocks.filter(b =>
                b.id !== pickingChapterBlockId &&
                b.subject_id === block.subject_id &&
                b.chapter_name === chapterName &&
                b.type === 'WORK'
            ).length;
            const totalCount = dbCount + planCount;
            if (totalCount === 0) {
                nextSuggestedId = 'a3'; // Priming
                nextSuggestionLabel = t('plan.suggestion_priming');
            } else if (totalCount === 1) {
                nextSuggestedId = 'disc1'; // Première Approche
                nextSuggestionLabel = t('plan.suggestion_first_approach');
            }
        }
        setSuggestedTechniqueId(nextSuggestedId);
        setSuggestionLabel(nextSuggestionLabel);

        setPickingBlockId(pickingChapterBlockId); // Trigger technique selection right after
        setPickingChapterBlockId(null);
    };

    const handleObjectiveChange = (blockId: string, value: string) => {
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, objective: value } : b));
    };

    const deleteCycle = (id: string) => {
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        import('../lib/sounds').then(m => m.playSFX('glass_ui_cancel', 'glassmorphism'));
        const newBlocks = [...blocks];
        if (block.cycle_id) {
            const firstIdx = newBlocks.findIndex(b => b.cycle_id === block.cycle_id);
            let lastIdx = -1;
            for (let i = newBlocks.length - 1; i >= 0; i--) {
                if (newBlocks[i].cycle_id === block.cycle_id) {
                    lastIdx = i;
                    break;
                }
            }
            if (firstIdx !== -1 && lastIdx !== -1) {
                let removeCount = lastIdx - firstIdx + 1;
                if (firstIdx + removeCount < newBlocks.length && newBlocks[firstIdx + removeCount].type === 'BREAK') {
                    removeCount++;
                }
                newBlocks.splice(firstIdx, removeCount);
            }
        } else {
            const idx = blocks.findIndex(b => b.id === id);
            newBlocks.splice(idx, 1);
            if (idx < newBlocks.length && newBlocks[idx].type === 'BREAK') {
                newBlocks.splice(idx, 1);
            }
        }
        setBlocks(newBlocks);
    };

    const startSession = () => {
        if (blocks.length === 0) return;
        import('../lib/sounds').then(m => m.playSFX('glass_session_start', 'glassmorphism'));
        const plannedMinutes = blocks.reduce((acc, b) => acc + b.minutes, 0);
        const session = {
            sessionId: crypto.randomUUID(),
            startedAt: new Date().toISOString(),
            nowBlockIdx: 0,
            remainingSeconds: blocks[0]?.minutes * 60 || 0,
            paused: false,
            draft: blocks,
            template,
            repeats,
            plannedMinutes,
            fiveMinAlert,
        };
        localStorage.setItem('activeSession', JSON.stringify(session));
        navigate('/session');
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'z') {
                if (e.shiftKey && canRedo) redo();
                else if (!e.shiftKey && canUndo) undo();
            }
            if (e.key === 'Escape') {
                setOpenMenuBlockId(null);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [undo, redo, canUndo, canRedo]);

    useEffect(() => {
        if (!openMenuBlockId) return;
        const handleClickOutside = () => { setOpenMenuBlockId(null); };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuBlockId]);

    useEffect(() => {
        if (!tagFilterOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) {
                setTagFilterOpen(false);
                setTagFilterQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [tagFilterOpen]);

    // All work blocks have a subject + objective filled
    const workBlocks = blocks.filter(b => b.type === 'WORK');
    const allFilled = workBlocks.length > 0 && workBlocks.every(b => b.subject_id && b.objective.trim().length > 0);

    // Summarize times
    const totalWork = workBlocks.reduce((acc, b) => acc + b.minutes, 0);
    const totalPrep = blocks.filter(b => b.type === 'PREP').reduce((acc, b) => acc + b.minutes, 0);
    const totalBreak = blocks.filter(b => b.type === 'BREAK').reduce((acc, b) => acc + b.minutes, 0);

    const now = new Date();
    const endsAt = new Date(now.getTime() + (totalWork + totalPrep + totalBreak) * 60000);
    const endsText = `${endsAt.getHours().toString().padStart(2, '0')}:${endsAt.getMinutes().toString().padStart(2, '0')}`;
    const incompleteWorkBlocks = workBlocks.filter(b => !b.objective?.trim()).length;
    const startTooltip = incompleteWorkBlocks > 0
        ? t('plan.blocks_incomplete').replace('{n}', String(incompleteWorkBlocks))
        : undefined;

    return (
        <div className={`planner-page fade-in ${isDragging || (isMouseDownOnSubject && blocks.length > 0) ? 'is-dragging' : ''} ${isMouseDownOnSubject && blocks.length === 0 ? 'is-dragging-empty' : ''} ${resizingBlockId ? 'is-resizing' : ''}`}>
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-purple"><Calendar size={20} /></div>
                    <h1>{t('plan.title')}</h1>
                </div>
            </div>

            <div className="planner-toolbar">
                <p className="drag-dim planner-session-info">{t('plan.ends_at')} {endsText} • {totalWork}m {t('plan.work')}{totalPrep > 0 ? `, ${totalPrep}m ${t('plan.prep')}` : ''}{totalBreak > 0 ? `, ${totalBreak}m ${t('plan.rest')}` : ''}</p>
                <div className="planner-controls">
                    <div className="planner-control-group drag-dim">
                        <label className="planner-control-label">{t('plan.style')}</label>
                        <CustomSelect
                            value={template}
                            onChange={(val) => setTemplate(val)}
                            options={Object.keys(TEMPLATES).map(k => ({ value: k, label: k }))}
                        />
                        {template !== 'Custom' && (
                            <span className="planner-template-desc">
                                {TEMPLATES[template].work}m {t('plan.work')} · {TEMPLATES[template].break}m {t('plan.rest')}
                            </span>
                        )}
                    </div>
                    {template === 'Custom' && (
                        <div className="planner-custom-group drag-dim">
                            <div className="planner-custom-input-group">
                                <label className="planner-custom-input-label">{t('plan.work_m')}</label>
                                <input type="number" min="1" max="300" className="planner-custom-input" value={customWork} onChange={e => setCustomWork(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="planner-custom-input-group">
                                <label className="planner-custom-input-label">{t('plan.break_m')}</label>
                                <input type="number" min="1" max="180" className="planner-custom-input" value={customBreak} onChange={e => setCustomBreak(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="planner-custom-input-group">
                                <label className="planner-custom-input-label">{t('plan.prep_m')}</label>
                                <input type="number" min="0" max="60" className="planner-custom-input" value={customPrep} onChange={e => setCustomPrep(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                    )}
                    <div className="planner-repeats-group drag-dim">
                        <label className="planner-repeats-label">{t('plan.repeats')}</label>
                        <div className="planner-repeats-control">
                            <button className="btn-repeat btn-repeat-minus" onClick={() => setRepeats(Math.max(1, repeats - 1))} onMouseEnter={() => playSFX('glass_ui_hover', theme)}>-</button>
                            <span className="planner-repeats-value">{repeats}</span>
                            <button className="btn-repeat btn-repeat-plus" onClick={() => setRepeats(Math.min(12, repeats + 1))} onMouseEnter={() => playSFX('glass_ui_hover', theme)}>+</button>
                        </div>
                    </div>

                    <div className="planner-undo-redo drag-dim">
                        <button
                            className="btn btn-icon planner-undo-btn"
                            onClick={undo}
                            disabled={!canUndo}
                            title={t('plan.undo')}
                            aria-label={t('plan.undo')}
                        >
                            <Undo2 size={16} />
                        </button>
                        <button
                            className="btn btn-icon planner-undo-btn"
                            onClick={redo}
                            disabled={!canRedo}
                            title={t('plan.redo')}
                            aria-label={t('plan.redo')}
                        >
                            <Redo2 size={16} />
                        </button>
                    </div>

                    <button
                        className={`btn btn-primary btn-holographic ${isMouseDownOnSubject && blocks.length === 0 ? 'btn-pulse-hint' : ''}`}
                        onClick={addBlocks}
                        onMouseEnter={() => playSFX('glass_ui_hover', theme)}
                    >
                        {t('plan.add_to_timeline')}
                    </button>

                    <button
                        className={`btn btn-icon plan-five-min-btn ${fiveMinAlert ? 'active' : ''}`}
                        onClick={() => {
                            const next = !fiveMinAlert;
                            setFiveMinAlert(next);
                            localStorage.setItem('study-buddy-five-min-alert', String(next));
                        }}
                        title={t('plan.five_min_alert')}
                        aria-label={t('plan.five_min_alert')}
                    >
                        {fiveMinAlert ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>

                    <div
                        className={`btn-start-session-wrapper ${blocks.length > 0 ? 'has-blocks' : ''} drag-dim`}
                        key={blocks.length > 0 ? 'active' : 'inactive'}
                        onMouseEnter={() => playSFX('glass_ui_hover', theme)}
                    >
                        <img
                            src="/assets/images/01_mascot-pop-out.png"
                            className="btn-start-mascot"
                            alt=""
                            aria-hidden="true"
                        />
                        <button
                            className={`btn btn-primary btn-start-session ${blocks.length > 0 ? 'btn-start-session-ready' : ''} ${allFilled ? 'btn-start-session-full' : ''}`}
                            onClick={startSession}
                            disabled={blocks.length === 0}
                            title={startTooltip}
                        >
                            {t('plan.start_session')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="planner-compass"><WeeklyCompass /></div>

            <div className="planner-content-area">
                {/* Subjects List */}
                <div className="glass planner-subjects-panel">
                    <h3>{t('plan.drag_subjects')}</h3>
                    {allTags.length > 0 && (
                        <div className="plan-tag-filter" ref={tagFilterRef}>
                            <button
                                className={`plan-tag-filter-btn ${planTagFilter !== null ? 'has-filter' : ''}`}
                                onClick={() => { setTagFilterOpen(o => !o); setTagFilterQuery(''); }}
                                aria-haspopup="true"
                                aria-expanded={tagFilterOpen}
                            >
                                <span className="plan-tag-filter-label">
                                    {planTagFilter ?? t('plan.filter_by_tag')}
                                </span>
                                {planTagFilter !== null && (
                                    <span
                                        className="plan-tag-filter-clear"
                                        role="button"
                                        aria-label={t('plan.all')}
                                        onClick={e => { e.stopPropagation(); setPlanTagFilter(null); setTagFilterOpen(false); }}
                                    >
                                        ×
                                    </span>
                                )}
                                <ChevronDown size={13} className={`plan-tag-filter-chevron ${tagFilterOpen ? 'open' : ''}`} />
                            </button>
                            {tagFilterOpen && (() => {
                                const filtered = allTags.filter(tag => tag.name.includes(tagFilterQuery.toLowerCase().trim()));
                                const selectOption = (idx: number) => {
                                    setPlanTagFilter(filtered[idx].name);
                                    setTagFilterOpen(false);
                                    setTagFilterQuery('');
                                    setTagFilterHighlight(0);
                                };
                                return (
                                <div className="plan-tag-filter-dropdown" role="menu">
                                    <input
                                        type="text"
                                        className="plan-tag-filter-search"
                                        placeholder={t('plan.filter_by_tag')}
                                        value={tagFilterQuery}
                                        onChange={e => { setTagFilterQuery(e.target.value); setTagFilterHighlight(0); }}
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setTagFilterHighlight(h => {
                                                    const next = Math.min(h + 1, filtered.length - 1);
                                                    const el = tagFilterListRef.current?.children[next] as HTMLElement | undefined;
                                                    el?.scrollIntoView({ block: 'nearest' });
                                                    return next;
                                                });
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setTagFilterHighlight(h => {
                                                    const next = Math.max(h - 1, 0);
                                                    const el = tagFilterListRef.current?.children[next] as HTMLElement | undefined;
                                                    el?.scrollIntoView({ block: 'nearest' });
                                                    return next;
                                                });
                                            } else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (filtered.length > 0) selectOption(tagFilterHighlight);
                                            } else if (e.key === 'Escape') {
                                                setTagFilterOpen(false);
                                                setTagFilterQuery('');
                                                setTagFilterHighlight(0);
                                            }
                                        }}
                                    />
                                    <div className="plan-tag-filter-list" ref={tagFilterListRef}>
                                        {filtered.map((tag, i) => (
                                            <button
                                                key={tag.id}
                                                className={`plan-tag-filter-item ${planTagFilter === tag.name ? 'active' : ''} ${tagFilterHighlight === i ? 'highlighted' : ''}`}
                                                role="menuitem"
                                                onMouseEnter={() => setTagFilterHighlight(i)}
                                                onClick={() => selectOption(i)}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                );
                            })()}
                        </div>
                    )}
                    <div className="planner-subjects-list">
                        {subjects.filter(s => planTagFilter === null || (subjectTagsMap.get(s.id) ?? []).includes(planTagFilter)).map((s) => (
                            <div
                                key={s.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, s.id)}
                                onDragEnd={handleDragEnd}
                                onMouseDown={() => handleSubjectMouseDown(s.id)}
                                className={`drag-subject-item ${((isDragging || isMouseDownOnSubject) && draggingSubjectId === s.id) ? 'drag-active' : ''} ${((isDragging || isMouseDownOnSubject) && draggingSubjectId !== s.id) ? 'drag-dim' : ''}`}
                                onMouseEnter={() => { if (!isDragging) playSFX('glass_ui_hover', theme); }}
                                title={t('plan.drag_to_add')}
                            >
                                <GripVertical size={16} className="drag-handle-icon" aria-hidden="true" />
                                <strong>{s.name}</strong>
                                {prioritySubjectIds.has(s.id) && (
                                    <span className="priority-badge">{isTerminal ? '[!]' : t('plan.priority')}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div className="glass planner-timeline">
                    {blocks.length === 0 ? (
                        <div className="timeline-empty-state">
                            <div className="timeline-empty-icon">⏳</div>
                            <h3>{t('plan.timeline_empty_title')}</h3>
                            <p>{t('plan.timeline_empty_desc')}</p>
                            {isMouseDownOnSubject && (
                                <div className="timeline-drag-hint animate-bounce">
                                    {t('plan.timeline_build_first')}
                                </div>
                            )}
                        </div>
                    ) : (
                        (() => {
                            const groupedBlocks: Block[][] = [];
                            let currentCycleId: string | null = null;
                            let currentGroup: Block[] = [];

                            blocks.forEach(b => {
                                if (b.type === 'WORK' && b.cycle_id) {
                                    if (b.cycle_id === currentCycleId) {
                                        currentGroup.push(b);
                                    } else {
                                        if (currentGroup.length > 0) groupedBlocks.push(currentGroup);
                                        currentCycleId = b.cycle_id;
                                        currentGroup = [b];
                                    }
                                } else {
                                    if (currentGroup.length > 0) {
                                        groupedBlocks.push(currentGroup);
                                        currentGroup = [];
                                        currentCycleId = null;
                                    }
                                    groupedBlocks.push([b]);
                                }
                            });
                            if (currentGroup.length > 0) groupedBlocks.push(currentGroup);

                            const renderBlockNode = (block: Block) => {
                                const isWork = block.type === 'WORK';
                                const subject = subjects.find(s => s.id === block.subject_id);
                                const technique = TECHNIQUES.find(t => t.id === block.technique_id);
                                const isDropTarget = isWork && !block.subject_id;
                                const isHovered = hoveredBlockId === block.id;
                                const subjectChapters = isWork && subject ? getChaptersForSubject(subject.id) : [];
                                const hasChapters = subjectChapters.length > 0;

                                // Pixel scaling: 5px per minute
                                const heightPx = block.minutes * PIXELS_PER_MINUTE;
                                const isSmall = block.minutes < 15;

                                return (
                                    <div
                                        key={block.id}
                                        data-block-id={block.id}
                                        onDrop={isWork ? e => handleDrop(e, block.id) : undefined}
                                        onDragOver={isWork ? handleDragOver : undefined}
                                        onDragEnter={isWork ? () => handleBlockDragEnter(block.id) : undefined}
                                        onDragLeave={isWork ? handleBlockDragLeave : undefined}
                                        className={`planner-block block-type-${block.type.toLowerCase()} ${isWork && block.subject_id ? (!isDropTarget ? 'bg-card border-solid' : 'bg-transparent border-dashed') : 'bg-transparent'} ${(isDragging || isMouseDownOnSubject) && isDropTarget ? 'drop-target' : ''} ${(isDragging || isMouseDownOnSubject) && !isDropTarget ? 'drag-dim' : ''} ${isHovered ? 'drop-hover' : ''} ${landedBlockIds.has(block.id) ? 'block-drop-landed' : ''}`}
                                        onMouseEnter={() => { if (isWork && block.subject_id) playSFX('glass_ui_hover', theme); }}
                                        style={{ '--block-min-height': isWork ? `${Math.max(heightPx, 130)}px` : '40px' } as React.CSSProperties}
                                    >
                                        {isWork && block.subject_id && (
                                            <div
                                                onMouseDown={(e) => handleResizeStart(e, block.id)}
                                                className={`block-resize-handle${resizingBlockId === block.id ? ' grabbing' : ''}`}
                                                title="Drag to adjust time"
                                            >
                                                <div className="block-resize-dots">
                                                    {[...Array(8)].map((_, i) => (
                                                        <div key={i} className="block-resize-dot" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="block-time-info">
                                            {isSmall ? (
                                                <div className="block-time-small">
                                                    <span>{block.minutes}m</span>
                                                    <span className={`block-type-label small ${isWork ? 'work' : ''}`}>{block.type}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {block.minutes}m<br />
                                                    <span className={`block-type-label ${isWork ? 'work' : ''}`}>{block.type}</span>
                                                </>
                                            )}
                                        </div>

                                        {isWork ? (
                                            <div className="block-content-area">
                                                {subject ? (
                                                    <div className="block-subject-details">
                                                        <div className="block-subject-header">
                                                            <strong className="block-subject-name">{subject.name}</strong>
                                                            <div className="block-readiness-bar" aria-hidden="true">
                                                                <span className="block-readiness-dot done" title="Subject" />
                                                                <span className={`block-readiness-dot ${block.chapter_name ? 'done' : ''}`} title="Chapter" />
                                                                <span className={`block-readiness-dot ${block.objective?.trim() ? 'done' : ''}`} title="Objective" />
                                                            </div>
                                                        </div>
                                                        {hasChapters ? (
                                                            <button
                                                                onClick={() => setPickingChapterBlockId(block.id)}
                                                                className={`block-chapter-button ${block.chapter_name ? 'selected' : 'empty'}`}
                                                                aria-label={block.chapter_name ? t('plan.chapter_label') + ` ${block.chapter_name}` : t('plan.select_chapter')}
                                                            >
                                                                <span>{block.chapter_name || t('plan.select_chapter')}</span>
                                                                <ChevronDown size={14} opacity={0.5} />
                                                            </button>
                                                        ) : (
                                                            <div className="block-no-chapters">
                                                                {t('plan.no_chapters')}
                                                            </div>
                                                        )}
                                                        <button
                                                            className={`block-technique-inline ${block.technique_id ? 'has-technique' : 'no-technique'}`}
                                                            onClick={() => setPickingBlockId(block.id)}
                                                            disabled={hasChapters && !block.chapter_name}
                                                            title={hasChapters && !block.chapter_name ? t('plan.select_chapter_first') : technique?.hint}
                                                            aria-label={t('plan.add_technique')}
                                                        >
                                                            <Zap size={13} className="technique-btn-icon" />
                                                            {block.technique_id ? (
                                                                <span className={`block-technique-tag tier-${technique?.tier.toLowerCase()}`}>
                                                                    {technique?.name}
                                                                </span>
                                                            ) : (
                                                                <span className="technique-btn-label">{t('plan.add_technique')}</span>
                                                            )}
                                                        </button>
                                                        <input
                                                            type="text"
                                                            placeholder={t('plan.objective_placeholder')}
                                                            value={block.objective}
                                                            onChange={e => handleObjectiveChange(block.id, e.target.value)}
                                                            className={`block-objective-input${!block.objective ? ' empty' : ''}`}
                                                            aria-label={t('plan.objective_label')}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="block-drop-prompt">{t('plan.drop_subject')}</span>
                                                )}

                                                <div className="block-menu-container">
                                                    <button
                                                        className="btn-icon"
                                                        aria-haspopup="true"
                                                        aria-expanded={openMenuBlockId === block.id}
                                                        aria-label={t('plan.block_options')}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuBlockId(openMenuBlockId === block.id ? null : block.id);
                                                        }}
                                                    >
                                                        <MoreVertical size={20} />
                                                    </button>
                                                    {openMenuBlockId === block.id && (
                                                        <div className="block-menu-dropdown block-menu-dropdown-open" role="menu">
                                                            <button className="block-menu-btn" role="menuitem" onClick={() => { clearBlock(block.id); setOpenMenuBlockId(null); }}>{t('plan.clear_block')}</button>
                                                            <button className="block-menu-btn danger" role="menuitem" onClick={() => { deleteCycle(block.id); setOpenMenuBlockId(null); }}>{t('plan.delete_cycle')}</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="block-break-content">
                                                {block.type === 'BREAK' ? t('plan.break_water') : t('plan.prep_materials')}
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            return groupedBlocks.map((group) => {
                                const isWorkGroup = group[0].type === 'WORK' && group[0].cycle_id;

                                if (isWorkGroup) {
                                    const totalMinutes = group.reduce((acc, b) => acc + b.minutes, 0);
                                    return (
                                        <div key={`group-${group[0].cycle_id}`} className="study-block-group">
                                            <div className="study-block-group-header">
                                                <div className="study-block-group-dot"></div>
                                                {t('plan.study_block')} ({totalMinutes}m {t('plan.m_limit')})
                                            </div>
                                            {group.map((block) => renderBlockNode(block))}
                                        </div>
                                    );
                                } else {
                                    return renderBlockNode(group[0]);
                                }
                            });
                        })()
                    )}
                </div>
            </div>

            {(() => {
                if (!pickingBlockId) return null;
                const pickingBlock = blocks.find(b => b.id === pickingBlockId);
                let recommendedCategory: TechCategory | undefined;
                if (pickingBlock?.subject_id && pickingBlock.chapter_name) {
                    const chs = getChaptersForSubject(pickingBlock.subject_id);
                    const ch = chs.find(c => c.name === pickingBlock.chapter_name);
                    if (ch?.focusType) {
                        if (ch.focusType === 'skill') recommendedCategory = 'faire';
                        else if (ch.focusType === 'comprehension') recommendedCategory = 'comprendre';
                        else if (ch.focusType === 'memorisation') recommendedCategory = 'memoriser';
                    }
                }

                const clearSuggestion = () => {
                    setSuggestedTechniqueId(null);
                    setSuggestionLabel(null);
                };
                const subjectName = subjects.find(s => s.id === pickingBlock?.subject_id)?.name ?? null;
                const chapterName = pickingBlock?.chapter_name ?? null;
                return (
                    <TechniquePickerModal
                        onClose={() => { setPickingBlockId(null); clearSuggestion(); }}
                        onSelect={(id, objective) => { handleTechniqueSelected(id, objective); clearSuggestion(); }}
                        currentSelection={pickingBlock?.technique_id || ""}
                        currentObjective={pickingBlock?.objective || ""}
                        errorLogEntries={errorLogEntries}
                        recommendedCategory={recommendedCategory}
                        suggestedTechniqueId={suggestedTechniqueId}
                        suggestionLabel={suggestionLabel}
                        subjectName={subjectName}
                        chapterName={chapterName}
                    />
                );
            })()}

            {(() => {
                if (!pickingChapterBlockId) return null;
                const pickingBlock = blocks.find(b => b.id === pickingChapterBlockId);
                if (!pickingBlock || !pickingBlock.subject_id) return null;

                return (
                    <ChapterPickerModal
                        subjectId={pickingBlock.subject_id}
                        techniqueId={pickingBlock.technique_id}
                        onClose={() => setPickingChapterBlockId(null)}
                        onSelect={handleChapterSelectedModal}
                        currentSelection={pickingBlock.chapter_name || null}
                    />
                );
            })()}

            {flyingSubject && (
                <div
                    className="flying-subject-pill"
                    key={flyingSubject.id}
                    style={{
                        top: flyingSubject.fromY,
                        left: flyingSubject.fromX,
                        '--dx': `${flyingSubject.dx}px`,
                        '--dy': `${flyingSubject.dy}px`,
                    } as React.CSSProperties}
                >
                    {flyingSubject.name}
                </div>
            )}
        </div >
    );
}
