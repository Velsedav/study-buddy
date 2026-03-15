import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubjects, getMetacognitionLogs } from '../lib/db';
import type { Subject } from '../lib/db';
import { useUndoRedo } from '../lib/undo';
import TechniquePickerModal from '../components/TechniquePickerModal';
import ChapterPickerModal from '../components/ChapterPickerModal';
import WeeklyCompass from '../components/WeeklyCompass';
import { TECHNIQUES, getTierColor, type TechCategory } from '../lib/techniques';
import { ChevronDown, MoreVertical, Calendar } from 'lucide-react';
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

export default function Plan() {
    const navigate = useNavigate();
    const { theme } = useSettings();
    const { t } = useTranslation();
    const [subjects, setSubjects] = useState<Subject[]>([]);
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
    const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
    const [openMenuBlockId, setOpenMenuBlockId] = useState<string | null>(null);
    const [chapterGateBlockId, setChapterGateBlockId] = useState<string | null>(null);

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
                    import('../lib/sounds').then(m => m.playSFX('drag_down', theme));
                } else {
                    import('../lib/sounds').then(m => m.playSFX('drag_up', theme));
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

        import('../lib/sounds').then(m => m.playSFX('drop_block', 'glassmorphism'));
        setBlocks(newBlocks);
    };

    // Handle Drag / Drop for Subjects
    const handleDragStart = (e: React.DragEvent, subjectId: string) => {
        e.dataTransfer.setData('subjectId', subjectId);
        setIsDragging(true);
        setDraggingSubjectId(subjectId);
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
        import('../lib/sounds').then(m => m.playSFX('drop_block', 'glassmorphism'));
        setBlocks(newBlocks);

        const subjectChapters = getChaptersForSubject(subjectId);
        if (subjectChapters.length > 0) {
            setPickingChapterBlockId(blockId);
        } else {
            setPickingBlockId(blockId);
        }

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

    const handleTechniqueSelected = (techId: string) => {
        if (!pickingBlockId) return;
        const newBlocks = blocks.map(b => {
            if (b.id === pickingBlockId) {
                return { ...b, technique_id: techId };
            }
            return b;
        });
        setBlocks(newBlocks);
        setPickingBlockId(null);
    };

    const clearBlock = (id: string) => {
        import('../lib/sounds').then(m => m.playSFX('cancelling', 'glassmorphism'));
        setBlocks(blocks.map(b => b.id === id ? { ...b, subject_id: null, technique_id: null, chapter_name: null, objective: '' } : b));
    };

    const handleChapterSelectedModal = (chapterName: string) => {
        setBlocks(blocks.map(b => b.id === pickingChapterBlockId ? { ...b, chapter_name: chapterName } : b));
        setPickingBlockId(pickingChapterBlockId); // Trigger technique selection right after
        setPickingChapterBlockId(null);
    };

    const handleObjectiveChange = (blockId: string, value: string) => {
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, objective: value } : b));
    };

    const deleteCycle = (id: string) => {
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        import('../lib/sounds').then(m => m.playSFX('cancelling', 'glassmorphism'));
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
        import('../lib/sounds').then(m => m.playSFX('start_study_session', 'glassmorphism'));
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
            plannedMinutes
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
                setChapterGateBlockId(null);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [undo, redo, canUndo, canRedo]);

    useEffect(() => {
        if (!openMenuBlockId) return;
        const handleClickOutside = () => { setOpenMenuBlockId(null); setChapterGateBlockId(null); };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuBlockId]);

    // Summarize times
    const totalWork = blocks.filter(b => b.type === 'WORK').reduce((acc, b) => acc + b.minutes, 0);
    const totalBreak = blocks.filter(b => b.type !== 'WORK').reduce((acc, b) => acc + b.minutes, 0);

    const now = new Date();
    const endsAt = new Date(now.getTime() + (totalWork + totalBreak) * 60000);
    const endsText = `${endsAt.getHours().toString().padStart(2, '0')}:${endsAt.getMinutes().toString().padStart(2, '0')}`;

    return (
        <div className={`planner-page fade-in ${isDragging || (isMouseDownOnSubject && blocks.length > 0) ? 'is-dragging' : ''} ${isMouseDownOnSubject && blocks.length === 0 ? 'is-dragging-empty' : ''} ${resizingBlockId ? 'is-resizing' : ''}`}>
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-purple"><Calendar size={20} /></div>
                    <h1>{t('plan.title')}</h1>
                </div>
            </div>

            <div className="planner-toolbar">
                <p className="drag-dim planner-session-info">{t('plan.ends_at')} {endsText} • {totalWork}m {t('plan.work')}, {totalBreak}m {t('plan.rest')}</p>
                <div className="planner-controls">
                    <div className="planner-control-group drag-dim">
                        <label className="planner-control-label">{t('plan.style')}</label>
                        <CustomSelect
                            value={template}
                            onChange={(val) => setTemplate(val)}
                            options={Object.keys(TEMPLATES).map(k => ({ value: k, label: k }))}
                        />
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
                            <button className="btn-repeat btn-repeat-minus" onClick={() => setRepeats(Math.max(1, repeats - 1))} onMouseEnter={() => playSFX('hover_sound', theme)}>-</button>
                            <span className="planner-repeats-value">{repeats}</span>
                            <button className="btn-repeat btn-repeat-plus" onClick={() => setRepeats(Math.min(12, repeats + 1))} onMouseEnter={() => playSFX('hover_sound', theme)}>+</button>
                        </div>
                    </div>

                    <button
                        className={`btn btn-primary btn-holographic ${isMouseDownOnSubject && blocks.length === 0 ? 'btn-pulse-hint' : ''}`}
                        onClick={addBlocks}
                        onMouseEnter={() => playSFX('hover_sound', theme)}
                    >
                        {t('plan.add_to_timeline')}
                    </button>

                    <div
                        className={`btn-start-session-wrapper ${blocks.length > 0 ? 'has-blocks' : ''} drag-dim`}
                        key={blocks.length > 0 ? 'active' : 'inactive'}
                        onMouseEnter={() => playSFX('hover_sound', theme)}
                    >
                        <img
                            src="/assets/images/01_mascot-pop-out.png"
                            className="btn-start-mascot"
                            alt=""
                            aria-hidden="true"
                        />
                        <button
                            className={`btn btn-primary btn-start-session ${blocks.length > 0 ? 'btn-start-session-ready' : ''}`}
                            onClick={startSession}
                            disabled={blocks.length === 0}
                        >
                            {t('plan.start_session')}
                        </button>
                    </div>
                </div>
            </div>

            <WeeklyCompass />

            <div className="planner-content-area">
                {/* Subjects List */}
                <div className="glass planner-subjects-panel">
                    <h3>{t('plan.drag_subjects')}</h3>
                    <div className="planner-subjects-list">
                        {subjects.map((s, idx) => (
                            <div
                                key={s.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, s.id)}
                                onDragEnd={handleDragEnd}
                                onMouseDown={() => handleSubjectMouseDown(s.id)}
                                className={`drag-subject-item ${((isDragging || isMouseDownOnSubject) && draggingSubjectId === s.id) ? 'drag-active' : ''} ${((isDragging || isMouseDownOnSubject) && draggingSubjectId !== s.id) ? 'drag-dim' : ''}`}
                                style={{ '--animation-order': idx } as any}
                                onMouseEnter={() => { if (!isDragging) playSFX('hover_sound', theme); }}
                            >
                                <strong>{s.name}</strong>
                                {prioritySubjectIds.has(s.id) && (
                                    <span className="priority-badge">{t('plan.priority')}</span>
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

                                // Pixel scaling: 5px per minute
                                const heightPx = block.minutes * PIXELS_PER_MINUTE;
                                const isSmall = block.minutes < 15;

                                return (
                                    <div
                                        key={block.id}
                                        onDrop={isWork ? e => handleDrop(e, block.id) : undefined}
                                        onDragOver={isWork ? handleDragOver : undefined}
                                        onDragEnter={isWork ? () => handleBlockDragEnter(block.id) : undefined}
                                        onDragLeave={isWork ? handleBlockDragLeave : undefined}
                                        className={`planner-block ${isWork && block.subject_id ? (!isDropTarget ? 'bg-card border-solid' : 'bg-transparent border-dashed') : 'bg-transparent'} ${(isDragging || isMouseDownOnSubject) && isDropTarget ? 'drop-target' : ''} ${(isDragging || isMouseDownOnSubject) && !isDropTarget ? 'drag-dim' : ''} ${isHovered ? 'drop-hover' : ''}`}
                                        onMouseEnter={() => { if (isWork && block.subject_id) playSFX('hover_sound', theme); }}
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
                                                            {technique && (
                                                                <span
                                                                    title={technique.hint}
                                                                    className="block-technique-tag"
                                                                    style={{
                                                                        '--tech-bg': getTierColor(technique.tier),
                                                                        '--tech-color': technique.tier === 'S' || technique.tier === 'F' ? '#fff' : '#000'
                                                                    } as React.CSSProperties}
                                                                >
                                                                    {technique.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(() => {
                                                            const subjectChapters = subject ? getChaptersForSubject(subject.id) : [];
                                                            if (subjectChapters.length === 0) {
                                                                return (
                                                                    <div className="block-no-chapters">
                                                                        {t('plan.no_chapters')}
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <button
                                                                    onClick={() => setPickingChapterBlockId(block.id)}
                                                                    className={`block-chapter-button ${block.chapter_name ? 'selected' : 'empty'}`}
                                                                    aria-label={block.chapter_name ? t('plan.chapter_label') + ` ${block.chapter_name}` : t('plan.select_chapter')}
                                                                >
                                                                    <span>{block.chapter_name || t('plan.select_chapter')}</span>
                                                                    <ChevronDown size={14} opacity={0.5} />
                                                                </button>
                                                            );
                                                        })()}
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
                                                            setChapterGateBlockId(null);
                                                        }}
                                                    >
                                                        <MoreVertical size={20} />
                                                    </button>
                                                    {openMenuBlockId === block.id && (
                                                        <div className="block-menu-dropdown block-menu-dropdown-open" role="menu">
                                                            {chapterGateBlockId === block.id ? (
                                                                <p className="block-menu-gate-msg">{t('plan.select_chapter_first')}</p>
                                                            ) : (
                                                                <button className="block-menu-btn" role="menuitem" onClick={() => {
                                                                    const subjectChapters = subject ? getChaptersForSubject(subject.id) : [];
                                                                    if (subjectChapters.length > 0 && !block.chapter_name) {
                                                                        setChapterGateBlockId(block.id);
                                                                    } else {
                                                                        setOpenMenuBlockId(null);
                                                                        setPickingBlockId(block.id);
                                                                    }
                                                                }}>{t('plan.change_technique')}</button>
                                                            )}
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

                return (
                    <TechniquePickerModal
                        onClose={() => setPickingBlockId(null)}
                        onSelect={handleTechniqueSelected}
                        currentSelection={pickingBlock?.technique_id || ""}
                        recommendedCategory={recommendedCategory}
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
                        onClose={() => setPickingChapterBlockId(null)}
                        onSelect={handleChapterSelectedModal}
                        currentSelection={pickingBlock.chapter_name || null}
                    />
                );
            })()}
        </div >
    );
}
