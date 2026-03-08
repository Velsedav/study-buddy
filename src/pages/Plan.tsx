import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubjects } from '../lib/db';
import type { Subject } from '../lib/db';
import { useUndoRedo } from '../lib/undo';
import TechniquePickerModal from '../components/TechniquePickerModal';
import ChapterPickerModal from '../components/ChapterPickerModal';
import { TECHNIQUES, getTierColor, type TechCategory } from '../lib/techniques';
import { MoreVertical } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import { getChaptersForSubject } from '../lib/chapters';
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
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [template, setTemplate] = useState('25/5');
    const [customWork, setCustomWork] = useState(25);
    const [customBreak, setCustomBreak] = useState(5);
    const [customPrep, setCustomPrep] = useState(5);
    const [repeats, setRepeats] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [draggingSubjectId, setDraggingSubjectId] = useState<string | null>(null);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    const { present: blocks, set: setBlocks, undo, canUndo, redo, canRedo } = useUndoRedo<Block[]>([]);

    const [pickingBlockId, setPickingBlockId] = useState<string | null>(null);
    const [pickingChapterBlockId, setPickingChapterBlockId] = useState<string | null>(null);
    const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);

    const dragRef = useRef<{ id: string, startY: number, startBlocks: Block[], lastDeltaSteps: number } | null>(null);

    const handleResizeStart = (e: React.MouseEvent, blockId: string) => {
        e.stopPropagation();
        dragRef.current = { id: blockId, startY: e.clientY, startBlocks: [...blocks], lastDeltaSteps: 0 };
        setResizingBlockId(blockId);
        document.body.style.cursor = 'grabbing';

        const tConfig = TEMPLATES[template] || TEMPLATES['25/5'];
        const maxWorkTime = tConfig.work;

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

            // Cannot exceed the template's max work time
            if (newMinutes > originalBlock.minutes) {
                let availableToAbsorb = 0;
                for (let i = idx + 1; i < startBlocks.length; i++) {
                    const nextBlock = startBlocks[i];
                    if (nextBlock.type === 'WORK' && !nextBlock.subject_id) {
                        availableToAbsorb += nextBlock.minutes;
                    } else {
                        break;
                    }
                }
                const maxPossibleNewMinutes = Math.min(maxWorkTime, originalBlock.minutes + availableToAbsorb);
                if (newMinutes > maxPossibleNewMinutes) {
                    newMinutes = maxPossibleNewMinutes;
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
                const deficit = Math.abs(actualDelta);
                if (idx + 1 < newBlocks.length && newBlocks[idx + 1].type === 'WORK' && !newBlocks[idx + 1].subject_id) {
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
                let remainingToAbsorb = actualDelta;
                let removeCount = 0;

                for (let i = idx + 1; i < newBlocks.length && remainingToAbsorb > 0; i++) {
                    const nextBlock = newBlocks[i];
                    if (nextBlock.type === 'WORK' && !nextBlock.subject_id) {
                        if (nextBlock.minutes > remainingToAbsorb) {
                            newBlocks[i] = { ...nextBlock, minutes: nextBlock.minutes - remainingToAbsorb };
                            remainingToAbsorb = 0;
                        } else {
                            remainingToAbsorb -= nextBlock.minutes;
                            removeCount++;
                        }
                    } else {
                        break;
                    }
                }

                if (removeCount > 0) {
                    newBlocks.splice(idx + 1, removeCount);
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
        setDraggingSubjectId(null);
        setHoveredBlockId(null);
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
        const tech = TECHNIQUES.find(t => t.id === techId);
        const newBlocks = blocks.map(b => {
            if (b.id === pickingBlockId) {
                return {
                    ...b,
                    technique_id: techId,
                    minutes: tech?.defaultMinutes ? tech.defaultMinutes : b.minutes
                };
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
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [undo, redo, canUndo, canRedo]);

    // Summarize times
    const totalWork = blocks.filter(b => b.type === 'WORK').reduce((acc, b) => acc + b.minutes, 0);
    const totalBreak = blocks.filter(b => b.type !== 'WORK').reduce((acc, b) => acc + b.minutes, 0);

    const now = new Date();
    const endsAt = new Date(now.getTime() + (totalWork + totalBreak) * 60000);
    const endsText = `${endsAt.getHours().toString().padStart(2, '0')}:${endsAt.getMinutes().toString().padStart(2, '0')}`;

    return (
        <div className={`planner-page fade-in ${isDragging ? 'is-dragging' : ''}`}>
            <div className="page-header drag-dim">
                <div>
                    <h1>Pomodoro Planner</h1>
                    <p>Ends roughly at {endsText} • {totalWork}m Work, {totalBreak}m Rest</p>
                </div>

                <div className="planner-controls">
                    <div className="planner-control-group">
                        <label className="planner-control-label">Style</label>
                        <CustomSelect
                            value={template}
                            onChange={(val) => setTemplate(val)}
                            options={Object.keys(TEMPLATES).map(k => ({ value: k, label: k }))}
                        />
                    </div>
                    {template === 'Custom' && (
                        <div className="planner-custom-group">
                            <div className="planner-custom-input-group">
                                <label className="planner-custom-input-label">Work (m)</label>
                                <input type="number" min="1" max="300" className="planner-custom-input" value={customWork} onChange={e => setCustomWork(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="planner-custom-input-group">
                                <label className="planner-custom-input-label">Break (m)</label>
                                <input type="number" min="1" max="180" className="planner-custom-input" value={customBreak} onChange={e => setCustomBreak(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="planner-custom-input-group">
                                <label className="planner-custom-input-label">Prep (m)</label>
                                <input type="number" min="0" max="60" className="planner-custom-input" value={customPrep} onChange={e => setCustomPrep(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                    )}
                    <div className="planner-repeats-group">
                        <label className="planner-repeats-label">Repeats</label>
                        <div className="planner-repeats-control">
                            <button className="btn-repeat btn-repeat-minus" onClick={() => setRepeats(Math.max(1, repeats - 1))}>-</button>
                            <span className="planner-repeats-value">{repeats}</span>
                            <button className="btn-repeat btn-repeat-plus" onClick={() => setRepeats(Math.min(12, repeats + 1))}>+</button>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary btn-holographic"
                        onClick={addBlocks}
                    >
                        Add to Timeline
                    </button>

                    <button
                        className="btn btn-primary btn-start-session"
                        onClick={startSession}
                    >
                        Start Session
                    </button>
                </div>
            </div>

            <div className="planner-content-area">
                {/* Subjects List */}
                <div className="glass planner-subjects-panel">
                    <h3>Drag Subjects</h3>
                    <div className="planner-subjects-list">
                        {subjects.map((s, idx) => (
                            <div
                                key={s.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, s.id)}
                                onDragEnd={handleDragEnd}
                                className={`drag-subject-item ${isDragging && draggingSubjectId === s.id ? 'drag-active' : ''} ${isDragging && draggingSubjectId !== s.id ? 'drag-dim' : ''}`}
                                style={{ '--animation-order': idx } as any}
                            >
                                <strong>{s.name}</strong>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div className="glass planner-timeline">
                    {(() => {
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
                                    className={`planner-block ${isWork && block.subject_id ? (!isDropTarget ? 'bg-card border-solid' : 'bg-transparent border-dashed') : 'bg-transparent'} ${isDragging && isDropTarget ? 'drop-target' : ''} ${isDragging && !isDropTarget ? 'drag-dim' : ''} ${isHovered ? 'drop-hover' : ''}`}
                                    onMouseEnter={() => { if (isWork && block.subject_id) playSFX('hover_sound', theme); }}
                                    style={{
                                        minHeight: isWork ? `${Math.max(heightPx, 130)}px` : '40px',
                                    }}
                                >
                                    {isWork && block.subject_id && (
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, block.id)}
                                            className="block-resize-handle"
                                            style={{
                                                cursor: resizingBlockId === block.id ? 'grabbing' : 'grab',
                                            }}
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
                                                <div className="block-subject-details" style={{ paddingBottom: isWork ? '32px' : '0' }}>
                                                    <div className="block-subject-header">
                                                        <strong className="block-subject-name">{subject.name}</strong>
                                                        {technique && (
                                                            <span title={technique.hint} className="block-technique-tag" style={{
                                                                background: getTierColor(technique.tier),
                                                                color: technique.tier === 'S' || technique.tier === 'F' ? '#fff' : '#000'
                                                            }}>
                                                                {technique.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(() => {
                                                        const subjectChapters = subject ? getChaptersForSubject(subject.id) : [];
                                                        if (subjectChapters.length === 0) {
                                                            return (
                                                                <div className="block-no-chapters">
                                                                    No chapters defined for this subject.
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <button
                                                                onClick={() => setPickingChapterBlockId(block.id)}
                                                                className={`block-chapter-button ${block.chapter_name ? 'selected' : 'empty'}`}
                                                            >
                                                                <span>{block.chapter_name || "Select a chapter..."}</span>
                                                                <MoreVertical size={14} opacity={0.5} style={{ transform: 'rotate(90deg)' }} />
                                                            </button>
                                                        );
                                                    })()}
                                                    <input
                                                        type="text"
                                                        placeholder="Ambitious objective BUT doable!"
                                                        value={block.objective}
                                                        onChange={e => handleObjectiveChange(block.id, e.target.value)}
                                                        className="block-objective-input"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="block-drop-prompt">Drop a subject here</span>
                                            )}

                                            <div className="block-menu-container">
                                                <button className="btn-icon">
                                                    <MoreVertical size={20} />
                                                </button>
                                                <div className="block-menu-dropdown">
                                                    <button className="block-menu-btn" onClick={() => {
                                                        const subjectChapters = subject ? getChaptersForSubject(subject.id) : [];
                                                        if (subjectChapters.length > 0 && !block.chapter_name) {
                                                            alert("Please select a Chapter first. This helps us recommend the best techniques for your specific study focus!");
                                                        } else {
                                                            setPickingBlockId(block.id);
                                                        }
                                                    }}>Change technique...</button>
                                                    <button className="block-menu-btn" onClick={() => clearBlock(block.id)}>Clear block</button>
                                                    <button className="block-menu-btn danger" onClick={() => deleteCycle(block.id)}>Delete cycle</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="block-break-content">
                                            {block.type === 'BREAK' ? 'Take a break, maybe stretch a little!' : 'Prepare your materials.'}
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
                                            Study Block ({totalMinutes}m Limit)
                                        </div>
                                        {group.map((block) => renderBlockNode(block))}
                                    </div>
                                );
                            } else {
                                return renderBlockNode(group[0]);
                            }
                        });
                    })()}
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
