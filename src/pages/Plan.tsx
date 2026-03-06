import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubjects } from '../lib/db';
import type { Subject } from '../lib/db';
import { useUndoRedo } from '../lib/undo';
import TechniquePickerModal from '../components/TechniquePickerModal';
import { TECHNIQUES, getTierColor } from '../lib/techniques';
import { MoreVertical } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';

type BlockType = 'PREP' | 'WORK' | 'BREAK';

interface Block {
    id: string;
    type: BlockType;
    minutes: number;
    subject_id: string | null;
    technique_id: string | null;
    objective: string;
    cycle_id?: string;
}

const TEMPLATES: Record<string, { work: number, break: number, prep: number }> = {
    '25/5': { work: 25, break: 5, prep: 10 },
    '50/10': { work: 50, break: 10, prep: 10 },
    '90/20': { work: 90, break: 20, prep: 10 }
};

const PIXELS_PER_MINUTE = 16;

export default function Plan() {
    const navigate = useNavigate();
    const { theme } = useSettings();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [template, setTemplate] = useState('25/5');
    const [repeats, setRepeats] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [draggingSubjectId, setDraggingSubjectId] = useState<string | null>(null);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

    const { present: blocks, set: setBlocks, undo, canUndo, redo, canRedo } = useUndoRedo<Block[]>([]);

    const [pickingBlockId, setPickingBlockId] = useState<string | null>(null);
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
        const tConfig = TEMPLATES[template] || TEMPLATES['25/5'];
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
        setPickingBlockId(blockId);
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
        setBlocks(blocks.map(b => b.id === id ? { ...b, subject_id: null, technique_id: null, objective: '' } : b));
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
        <div className={`planner-page ${isDragging ? 'is-dragging' : ''}`}>
            <div className="page-header drag-dim" style={{ alignItems: 'flex-start' }}>
                <div>
                    <h1>Pomodoro Planner</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Ends roughly at {endsText} • {totalWork}m Work, {totalBreak}m Rest</p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div>
                        <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Style</label>
                        <CustomSelect
                            value={template}
                            onChange={(val) => setTemplate(val)}
                            style={{ height: '100%' }}
                            options={Object.keys(TEMPLATES).map(k => ({ value: k, label: k }))}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontWeight: 'bold' }}>Repeats</label>
                        <style>{`
                            .btn-repeat {
                                background: var(--text-dark);
                                color: var(--card-bg);
                                border: none;
                                border-radius: 0;
                                padding: 8px 18px;
                                height: 100%;
                                font-weight: bold;
                                font-size: 1.2rem;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            }
                            .btn-repeat:hover {
                                background: var(--card-bg);
                                color: var(--text-dark);
                            }
                            
                            /* Holographic Experimental Button */
                            @keyframes shimmer {
                                0% { background-position: -200% center; }
                                100% { background-position: 200% center; }
                            }
                            .btn-holographic {
                                position: relative;
                                overflow: hidden;
                                transition: transform 0.2s, box-shadow 0.2s;
                            }
                            .btn-holographic::before {
                                content: '';
                                position: absolute;
                                top: 0; left: 0; right: 0; bottom: 0;
                                background: linear-gradient(
                                    120deg, 
                                    transparent 0%, 
                                    rgba(255, 105, 180, 0.4) 20%, 
                                    rgba(0, 255, 255, 0.6) 40%, 
                                    rgba(255, 255, 255, 0.9) 50%,
                                    rgba(255, 255, 0, 0.6) 60%, 
                                    rgba(255, 105, 180, 0.4) 80%,
                                    transparent 100%
                                );
                                background-size: 200% auto;
                                opacity: 0;
                                transition: opacity 0.3s ease;
                                pointer-events: none;
                                mix-blend-mode: overlay;
                                z-index: 2;
                            }
                            .btn-holographic:hover::before {
                                opacity: 1;
                                animation: shimmer 2s linear infinite;
                            }
                        `}</style>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--text-dark)', height: '100%' }}>
                            <button className="btn-repeat" style={{ borderRight: '2px solid var(--text-dark)' }} onClick={() => setRepeats(Math.max(1, repeats - 1))}>-</button>
                            <span style={{ padding: '0 16px', minWidth: '40px', textAlign: 'center', fontWeight: 'bold' }}>{repeats}</span>
                            <button className="btn-repeat" style={{ borderLeft: '2px solid var(--text-dark)' }} onClick={() => setRepeats(Math.min(12, repeats + 1))}>+</button>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary btn-holographic"
                        onClick={addBlocks}
                        style={{ zIndex: 1, marginRight: '16px' }}
                    >
                        Add to Timeline
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={startSession}
                        style={{ zIndex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}
                    >
                        Start Session
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
                {/* Subjects List */}
                <div className="glass" style={{ width: '250px', padding: '16px', borderRadius: 'var(--border-radius-sm)', maxHeight: '70vh', overflowY: 'auto' }}>
                    <h3 style={{ marginBottom: '16px' }}>Drag Subjects</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {subjects.map(s => (
                            <div
                                key={s.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, s.id)}
                                onDragEnd={handleDragEnd}
                                className={`drag-subject-item ${isDragging && draggingSubjectId === s.id ? 'drag-active' : ''} ${isDragging && draggingSubjectId !== s.id ? 'drag-dim' : ''}`}
                            >
                                <strong>{s.name}</strong>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div className="glass timeline" style={{ flex: 1, padding: '24px', borderRadius: 'var(--border-radius)', minHeight: '500px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                    className={`planner-block ${isDragging && isDropTarget ? 'drop-target' : ''} ${isDragging && !isDropTarget ? 'drag-dim' : ''} ${isHovered ? 'drop-hover' : ''}`}
                                    onMouseEnter={() => { if (isWork && block.subject_id) playSFX('hover_sound', theme); }}
                                    style={{
                                        padding: '16px 24px 36px 24px',
                                        borderRadius: '12px',
                                        background: isWork ? 'var(--card-bg)' : 'transparent',
                                        border: isWork ? (block.subject_id ? '2px solid var(--primary)' : '2px dashed var(--primary)') : '1px solid transparent',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'stretch',
                                        gap: '16px',
                                        position: 'relative',
                                        height: isWork ? `${Math.max(heightPx, 110)}px` : 'auto',
                                        minHeight: isWork ? `${Math.max(heightPx, 110)}px` : '40px',
                                    }}
                                >
                                    {isWork && block.subject_id && (
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, block.id)}
                                            style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                width: '100%',
                                                cursor: resizingBlockId === block.id ? 'grabbing' : 'grab',
                                                zIndex: 5,
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                padding: '16px 0',
                                                background: 'linear-gradient(to top, rgba(0,0,0,0.05) 0%, transparent 100%)'
                                            }}
                                            title="Drag to adjust time"
                                        >
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, 4px)',
                                                gridTemplateRows: 'repeat(2, 4px)',
                                                gap: '4px',
                                                opacity: 0.5,
                                                userSelect: 'none'
                                            }}>
                                                {[...Array(8)].map((_, i) => (
                                                    <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ width: '80px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                        {isSmall ? (
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span>{block.minutes}m</span>
                                                <span style={{ fontSize: '0.7rem', color: isWork ? 'var(--primary-hover)' : 'inherit' }}>{block.type}</span>
                                            </div>
                                        ) : (
                                            <>
                                                {block.minutes}m<br />
                                                <span style={{ fontSize: '0.8rem', color: isWork ? 'var(--primary-hover)' : 'inherit' }}>{block.type}</span>
                                            </>
                                        )}
                                    </div>

                                    {isWork ? (
                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
                                            {subject ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, alignItems: 'stretch', paddingRight: '16px', position: 'relative', zIndex: 1, paddingBottom: isWork ? '16px' : '0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <strong style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subject.name}</strong>
                                                        {technique && (
                                                            <span title={technique.hint} style={{
                                                                background: getTierColor(technique.tier),
                                                                color: technique.tier === 'S' || technique.tier === 'F' ? '#fff' : '#000',
                                                                padding: '4px 8px',
                                                                borderRadius: '12px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 'bold',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {technique.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Ambitious objective BUT doable!"
                                                        value={block.objective}
                                                        onChange={e => handleObjectiveChange(block.id, e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            fontSize: '1rem',
                                                            height: 'auto',
                                                            minHeight: 'auto'
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>Drop a subject here</span>
                                            )}

                                            <div style={{ position: 'relative', alignSelf: 'flex-start' }} className="block-menu">
                                                <button className="btn-icon">
                                                    <MoreVertical size={20} />
                                                </button>
                                                <div className="menu-dropdown" style={{ display: 'none', position: 'absolute', right: 0, top: '100%', background: '#fff', boxShadow: 'var(--shadow-md)', borderRadius: '8px', zIndex: 10, padding: '8px', width: '200px' }}>
                                                    <button style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => setPickingBlockId(block.id)}>Change technique...</button>
                                                    <button style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => clearBlock(block.id)}>Clear block</button>
                                                    <button style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)' }} onClick={() => deleteCycle(block.id)}>Delete cycle</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1, color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
                                    <div key={`group-${group[0].cycle_id}`} style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px dashed var(--border)',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
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

            {
                pickingBlockId && (
                    <TechniquePickerModal
                        onClose={() => setPickingBlockId(null)}
                        onSelect={handleTechniqueSelected}
                        currentSelection={blocks.find(b => b.id === pickingBlockId)?.technique_id || ""}
                    />
                )
            }
        </div >
    );
}
