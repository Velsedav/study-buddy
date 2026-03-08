import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, mkdir, BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { createSubject, updateSubject } from '../lib/db';
import type { Subject, Tag } from '../lib/db';
import TagPicker from './TagPicker';
import { X, Plus, Trash2 } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import {
    getChaptersForSubject, addChapter, deleteChapter,
    incrementStudyCount, updateChapterFocusType,
    type Chapter, type FocusType, FOCUS_TYPE_LABELS, FOCUS_TYPE_COLORS
} from '../lib/chapters';

interface SubjectEditorModalProps {
    onClose: () => void;
    onSaved: () => void;
    editingSubject?: Subject & { tags: Tag[] };
}

export default function SubjectEditorModal({ onClose, onSaved, editingSubject }: SubjectEditorModalProps) {
    const { theme } = useSettings();
    const isEditing = !!editingSubject;
    const [name, setName] = useState(editingSubject?.name ?? '');
    const [selectedTags, setSelectedTags] = useState<string[]>(
        editingSubject?.tags.map(t => t.name) ?? []
    );
    const [pinned, setPinned] = useState(editingSubject?.pinned ?? false);
    const [coverPath, setCoverPath] = useState<string | null>(editingSubject?.cover_path ?? null);
    const [deadline, setDeadline] = useState<string>(editingSubject?.deadline ?? '');
    const [result, setResult] = useState<string>(editingSubject?.result ?? '');
    const [archived, setArchived] = useState<boolean>(editingSubject?.archived ?? false);

    // Chapter management
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [newChapterName, setNewChapterName] = useState('');

    useEffect(() => {
        if (editingSubject) {
            setChapters(getChaptersForSubject(editingSubject.id));
        }
    }, [editingSubject]);

    async function handlePickCover() {
        const selected = await open({
            multiple: false,
            filters: [{ name: 'Image', extensions: ['png', 'jpeg', 'jpg', 'gif', 'webp'] }]
        });

        if (selected && typeof selected === 'string') {
            try {
                const hasCoversDir = await exists('covers', { baseDir: BaseDirectory.AppData });
                if (!hasCoversDir) {
                    await mkdir('covers', { baseDir: BaseDirectory.AppData, recursive: true });
                }
                const ext = selected.split('.').pop();
                const newFileName = `covers/${crypto.randomUUID()}.${ext}`;
                await copyFile(selected, newFileName, { toPathBaseDir: BaseDirectory.AppData });
                setCoverPath(newFileName);
            } catch (e) {
                console.error('Failed to copy cover', e);
                alert('Failed to save cover image.');
            }
        }
    }

    async function handleSave() {
        if (!name.trim()) return;
        try {
            if (isEditing) {
                await updateSubject(editingSubject!.id, name.trim(), coverPath, selectedTags, deadline || null, result || null, archived);
            } else {
                const newSubj = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    cover_path: coverPath,
                    pinned,
                    created_at: new Date().toISOString(),
                    last_studied_at: null,
                    total_minutes: 0,
                    deadline: deadline || null,
                    result: result || null,
                    archived,
                };
                await createSubject(newSubj, selectedTags);
            }
            onSaved();
            onClose();
        } catch (e) {
            console.error(e);
            alert('Failed to save subject.');
        }
    }

    // ── Chapter handlers ──
    const handleAddChapter = () => {
        if (!editingSubject) return;
        const val = newChapterName.trim();
        if (!val) return;

        const existingMain = chapters.filter(c => /^Chapt\.\s*\d+/.test(c.name)).length;
        const parsed = parseInt(val);

        if (!isNaN(parsed) && parsed.toString() === val && parsed > 0 && parsed <= 50) {
            const newChaps = [];
            for (let i = 1; i <= parsed; i++) {
                newChaps.push(addChapter(editingSubject.id, `Chapt. ${existingMain + i}`));
            }
            setChapters([...chapters, ...newChaps]);
        } else if (val.includes('(')) {
            const groups: { name: string; subs: string[] }[] = [];
            let depth = 0, current = '';
            for (const char of val + ',') {
                if (char === '(') depth++;
                else if (char === ')') depth--;
                if (char === ',' && depth === 0) {
                    const piece = current.trim();
                    if (piece) {
                        const match = piece.match(/^(.+?)\s*\((.+)\)\s*$/);
                        if (match) {
                            groups.push({ name: match[1].trim(), subs: match[2].split(',').map(s => s.trim()).filter(Boolean) });
                        } else {
                            groups.push({ name: piece, subs: [] });
                        }
                    }
                    current = '';
                } else {
                    current += char;
                }
            }
            const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const newChaps: Chapter[] = [];
            let chapterNum = existingMain;
            for (const group of groups) {
                chapterNum++;
                newChaps.push(addChapter(editingSubject.id, `Chapt. ${chapterNum} ${group.name}`));
                group.subs.forEach((sub, idx) => {
                    const letter = idx < LETTERS.length ? LETTERS[idx] : `${idx + 1}`;
                    newChaps.push(addChapter(editingSubject.id, `  ${letter}. ${sub}`));
                });
            }
            setChapters([...chapters, ...newChaps]);
        } else {
            const ch = addChapter(editingSubject.id, val);
            setChapters([...chapters, ch]);
        }
        setNewChapterName('');
        playSFX('checklist_sound', theme);
    };

    const handleDeleteChapter = (id: string) => {
        const idx = chapters.findIndex(c => c.id === id);
        if (idx === -1) return;

        const chapter = chapters[idx];
        const isParent = /^Chapt\.\s*\d+/.test(chapter.name);

        // Collect IDs to delete
        const idsToDelete = [id];

        if (isParent) {
            // Also delete all following subchapters (entries starting with whitespace) until next parent chapter or end
            for (let i = idx + 1; i < chapters.length; i++) {
                if (/^\s+[A-Z]\./.test(chapters[i].name)) {
                    idsToDelete.push(chapters[i].id);
                } else {
                    break;
                }
            }
        }

        idsToDelete.forEach(cid => deleteChapter(cid));
        setChapters(chapters.filter(c => !idsToDelete.includes(c.id)));
    };

    const handleStudyChapter = (id: string) => {
        if (!editingSubject) return;
        incrementStudyCount(id);
        setChapters(getChaptersForSubject(editingSubject.id));
        playSFX('checklist_sound', theme);
    };

    const handleFocusTypeChange = (id: string, focusType: FocusType) => {
        if (!editingSubject) return;
        updateChapterFocusType(id, focusType);
        setChapters(getChaptersForSubject(editingSubject.id));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0,
                    width: '520px', maxWidth: '90vw',
                    background: 'var(--card-bg, #fff)',
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
                    display: 'flex', flexDirection: 'column',
                    animation: 'slideInRight 0.3s ease',
                    zIndex: 1000,
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{isEditing ? 'Edit Subject' : 'New Subject'}</h2>
                    <button className="btn-icon" onClick={onClose} style={{ padding: '4px' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {/* ── Subject Details ── */}
                    <div className="form-group">
                        <label>Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" autoFocus />
                    </div>

                    <div className="form-group">
                        <label>Tags</label>
                        <TagPicker selectedTags={selectedTags} onChange={setSelectedTags} />
                    </div>

                    {!isEditing && (
                        <div className="form-group">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
                                Pin this subject
                            </label>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Deadline (Optional)</label>
                        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Result / Grade (Optional)</label>
                        <input type="text" value={result} onChange={e => setResult(e.target.value)} placeholder="e.g. 18/20, A+, Passed" />
                    </div>

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />
                            Archived
                        </label>
                    </div>

                    <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label>Cover Image</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn btn-secondary" onClick={handlePickCover} style={{ fontSize: '0.85rem' }}>Choose Cover</button>
                            {coverPath && <button className="btn btn-secondary" onClick={() => setCoverPath(null)} style={{ fontSize: '0.85rem' }}>Remove</button>}
                            <span style={{ fontSize: '0.85rem', color: coverPath ? 'var(--success)' : 'var(--text-muted)' }}>
                                {coverPath ? 'Image selected!' : 'No image'}
                            </span>
                        </div>
                    </div>

                    {/* ── CHAPTERS SECTION ── */}
                    {isEditing && (
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>📖 Chapters ({chapters.length})</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                                {chapters.map(ch => {
                                    const isSubChapter = /^\s+[A-Z]\./.test(ch.name);
                                    return (
                                        <div key={ch.id} style={{
                                            padding: '10px 12px', borderRadius: '10px',
                                            background: isSubChapter ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.04)',
                                            marginLeft: isSubChapter ? '20px' : '0',
                                            borderLeft: isSubChapter ? '2px solid var(--glass-border)' : 'none',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    fontWeight: isSubChapter ? 400 : 600, fontSize: isSubChapter ? '0.85rem' : '0.9rem'
                                                }}>{ch.name}</span>
                                                <div style={{ display: 'flex', gap: '3px' }}>
                                                    {[0, 1, 2].map(i => (
                                                        <div key={i} style={{
                                                            width: '8px', height: '8px', borderRadius: '50%',
                                                            background: i < ch.studyCount ? 'var(--success)' : 'rgba(0,0,0,0.1)',
                                                        }} />
                                                    ))}
                                                </div>
                                                {ch.studyCount < 3 && (
                                                    <button
                                                        onClick={() => handleStudyChapter(ch.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 4px' }}
                                                        title="Mark as studied"
                                                    >+1</button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteChapter(ch.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                                                    title="Delete chapter"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                {(['skill', 'comprehension', 'memorisation'] as const).map(ft => {
                                                    const isActive = ch.focusType === ft;
                                                    return (
                                                        <button
                                                            key={ft}
                                                            onClick={() => handleFocusTypeChange(ch.id, isActive ? null : ft)}
                                                            style={{
                                                                background: isActive ? FOCUS_TYPE_COLORS[ft] : 'rgba(0,0,0,0.06)',
                                                                color: isActive ? '#fff' : 'var(--text-muted)',
                                                                border: 'none', borderRadius: '6px',
                                                                padding: '2px 7px', fontSize: '0.7rem',
                                                                fontWeight: isActive ? 700 : 500,
                                                                cursor: 'pointer', transition: 'all 0.15s ease',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                            title={FOCUS_TYPE_LABELS[ft]}
                                                        >
                                                            {FOCUS_TYPE_LABELS[ft]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add chapter input */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    type="text"
                                    placeholder="Topic (sub1, sub2), Topic2... or # for bulk"
                                    value={newChapterName}
                                    onChange={e => setNewChapterName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddChapter(); }}
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
                                />
                                <button
                                    onClick={handleAddChapter}
                                    style={{
                                        background: 'var(--primary)', color: '#fff', border: 'none',
                                        borderRadius: '8px', cursor: 'pointer', padding: '8px 12px',
                                        display: 'flex', alignItems: 'center',
                                    }}
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--glass-border)',
                    display: 'flex', justifyContent: 'flex-end', gap: '8px',
                }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>{isEditing ? 'Update' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
}
