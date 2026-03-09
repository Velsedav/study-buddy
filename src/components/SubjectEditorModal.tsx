import { useState, useEffect, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, mkdir, BaseDirectory, exists, readFile } from '@tauri-apps/plugin-fs';
import { createSubject, updateSubject } from '../lib/db';
import type { Subject, Tag } from '../lib/db';
import TagPicker from './TagPicker';
import { X, Plus, Trash2 } from 'lucide-react';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';
import {
    getChaptersForSubject, addChapter, deleteChapter,
    incrementStudyCount, updateChapterFocusType, updateChapterSpacing,
    getDefaultSpacing, parseSpacing,
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
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Convert bytes to data URL (helper similar to Home.tsx)
    const toDataUrl = (bytes: Uint8Array, ext: string) => {
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return `data:${mime};base64,${btoa(binary)}`;
    };

    useEffect(() => {
        if (coverPath) {
            readFile(coverPath, { baseDir: BaseDirectory.AppData }).then(bytes => {
                const ext = coverPath.split('.').pop()?.toLowerCase() || 'jpg';
                setPreviewUrl(toDataUrl(bytes, ext));
            }).catch(console.error);
        } else {
            setPreviewUrl(null);
        }
    }, [coverPath]);

    // Chapter management
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [newChapterName, setNewChapterName] = useState('');
    const [editingSpacingId, setEditingSpacingId] = useState<string | null>(null);

    const chaptersPreview = useMemo(() => {
        const val = newChapterName.trim();
        if (!val) return [];

        const existingMain = chapters.filter(c => /^Chapt\.\s*\d+/.test(c.name)).length;
        const parsed = parseInt(val);
        const preview: string[] = [];

        if (!isNaN(parsed) && parsed.toString() === val && parsed > 0 && parsed <= 50) {
            for (let i = 1; i <= parsed; i++) {
                preview.push(`Chapt. ${existingMain + i}`);
            }
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
            let chapterNum = existingMain;
            for (const group of groups) {
                chapterNum++;
                preview.push(`Chapt. ${chapterNum} ${group.name}`);
                group.subs.forEach((sub, idx) => {
                    const letter = idx < LETTERS.length ? LETTERS[idx] : `${idx + 1}`;
                    preview.push(`  ${letter}. ${sub}`);
                });
            }
        } else {
            preview.push(val);
        }
        return preview;
    }, [newChapterName, chapters]);

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
            await saveCover(selected);
        }
    }

    async function saveCover(pathOrBlob: string | Blob) {
        try {
            const hasCoversDir = await exists('covers', { baseDir: BaseDirectory.AppData });
            if (!hasCoversDir) {
                await mkdir('covers', { baseDir: BaseDirectory.AppData, recursive: true });
            }

            const id = crypto.randomUUID();
            let newFileName = '';

            if (typeof pathOrBlob === 'string') {
                const ext = pathOrBlob.split('.').pop();
                newFileName = `covers/${id}.${ext}`;
                await copyFile(pathOrBlob, newFileName, { toPathBaseDir: BaseDirectory.AppData });
            } else {
                const buffer = await pathOrBlob.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                newFileName = `covers/${id}.png`; // Paste usually gives png
                const { writeFile } = await import('@tauri-apps/plugin-fs');
                await writeFile(newFileName, bytes, { baseDir: BaseDirectory.AppData });
            }

            setCoverPath(newFileName);
        } catch (e) {
            console.error('Failed to save cover', e);
            alert('Failed to save cover image.');
        }
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    await saveCover(blob);
                }
            }
        }
    };

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
                    deleted_at: null,
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

    const handleSpacingCommit = (id: string, val: string) => {
        const trimmed = val.trim();
        const parsed = parseSpacing(trimmed);
        updateChapterSpacing(id, parsed.length > 0 ? trimmed : null);
        setChapters(getChaptersForSubject(editingSubject!.id));
        setEditingSpacingId(null);
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

                    {/* ── CHAPTERS SECTION ── */}
                    {isEditing && (
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>
                                📖 Chapitres ({chapters.filter(c => /^Chapt\.\s*\d+/.test(c.name)).length}),
                                Sous-chapitres ({chapters.filter(c => /^\s+[A-Z]\./.test(c.name)).length})
                            </h3>

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
                                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                                    {ch.studyCount > 0 && (
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700, marginRight: '2px' }}>
                                                            ×{ch.studyCount}
                                                        </span>
                                                    )}
                                                    {[0, 1, 2].map(i => (
                                                        <div key={i} style={{
                                                            width: '8px', height: '8px', borderRadius: '50%',
                                                            background: i < Math.min(ch.studyCount, 3) ? 'var(--success)' : 'rgba(0,0,0,0.1)',
                                                        }} />
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={() => handleStudyChapter(ch.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 4px' }}
                                                    title="Mark as studied"
                                                >+1</button>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>📅 Schedule:</span>
                                                {editingSpacingId === ch.id ? (
                                                    <input
                                                        type="text"
                                                        defaultValue={ch.spacingOverride || ''}
                                                        placeholder={getDefaultSpacing()}
                                                        autoFocus
                                                        style={{ fontSize: '0.75rem', padding: '1px 5px', borderRadius: '4px', width: '110px' }}
                                                        onBlur={e => handleSpacingCommit(ch.id, e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') setEditingSpacingId(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingSpacingId(ch.id)}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: 'pointer', padding: '1px 5px',
                                                            fontSize: '0.75rem', borderRadius: '4px',
                                                            color: ch.spacingOverride ? 'var(--primary)' : 'var(--text-muted)',
                                                            textDecoration: 'underline dotted',
                                                        }}
                                                        title="Click to set a custom review schedule for this chapter"
                                                    >
                                                        {ch.spacingOverride || 'Default'}
                                                    </button>
                                                )}
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
                                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem', borderRadius: '8px' }}
                                />
                                <button
                                    onClick={handleAddChapter}
                                    style={{
                                        background: 'var(--primary)', color: '#fff', border: 'none',
                                        borderRadius: '8px', cursor: 'pointer', padding: '6px 10px',
                                        display: 'flex', alignItems: 'center',
                                    }}
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            {/* Chapter Preview */}
                            {chaptersPreview.length > 0 && (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    background: 'rgba(var(--primary-rgb), 0.05)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(var(--primary-rgb), 0.1)',
                                    animation: 'fadeIn 0.2s ease-out'
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Aperçu des nouveaux chapitres :
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {chaptersPreview.map((p, i) => (
                                            <div key={i} style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-dark)',
                                                paddingLeft: p.startsWith('  ') ? '12px' : '0',
                                                opacity: 0.8
                                            }}>
                                                {p}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── COVER IMAGE SECTION ── */}
                    <div className="form-group" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                        <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600 }}>Cover Image</label>
                        <div
                            className="paste-frame"
                            tabIndex={0}
                            onPaste={handlePaste}
                            onClick={(e) => {
                                // Default click to pick cover if empty, otherwise just focus
                                if (!coverPath) handlePickCover();
                                else (e.currentTarget as HTMLElement).focus();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Delete' || e.key === 'Backspace') setCoverPath(null);
                            }}
                            style={{
                                width: '100%',
                                height: '200px',
                                borderRadius: '16px',
                                border: '2px dashed var(--primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                overflow: 'hidden',
                                position: 'relative',
                                background: 'rgba(var(--primary-rgb), 0.03)',
                                outline: 'none',
                                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.02)'
                            }}
                        >
                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Cover preview" />
                                    <div style={{
                                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
                                        opacity: 0, transition: 'opacity 0.2s', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem'
                                    }} className="hover-overlay">
                                        Click to change or Paste to replace
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                    <Plus size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                    <div style={{ fontWeight: 500 }}>Click to choose or Paste image</div>
                                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Supports shortcuts & right-click paste</div>
                                </div>
                            )}
                        </div>
                        {coverPath && (
                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => setCoverPath(null)} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                                    Remove Image
                                </button>
                            </div>
                        )}
                    </div>
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
