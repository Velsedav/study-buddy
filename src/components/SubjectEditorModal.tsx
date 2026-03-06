import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, mkdir, BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { createSubject, updateSubject } from '../lib/db';
import type { Subject, Tag } from '../lib/db';
import TagPicker from './TagPicker';

interface SubjectEditorModalProps {
    onClose: () => void;
    onSaved: () => void;
    /** If provided, the modal edits an existing subject instead of creating one */
    editingSubject?: Subject & { tags: Tag[] };
}

export default function SubjectEditorModal({ onClose, onSaved, editingSubject }: SubjectEditorModalProps) {
    const isEditing = !!editingSubject;
    const [name, setName] = useState(editingSubject?.name ?? '');
    const [selectedTags, setSelectedTags] = useState<string[]>(
        editingSubject?.tags.map(t => t.name) ?? []
    );
    const [pinned, setPinned] = useState(editingSubject?.pinned ?? false);
    const [coverPath, setCoverPath] = useState<string | null>(editingSubject?.cover_path ?? null);

    async function handlePickCover() {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Image',
                extensions: ['png', 'jpeg', 'jpg', 'gif', 'webp']
            }]
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
                await updateSubject(editingSubject!.id, name.trim(), coverPath, selectedTags);
            } else {
                const newSubj = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    cover_path: coverPath,
                    pinned,
                    created_at: new Date().toISOString(),
                    last_studied_at: null,
                    total_minutes: 0,
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{isEditing ? 'Edit Subject' : 'New Subject'}</h2>

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

                <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label>Cover Image</label>
                    {coverPath ? (
                        <div style={{ color: 'var(--success)', fontSize: '0.9rem' }}>Image selected!</div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No image selected.</div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={handlePickCover}>Choose Cover</button>
                        {coverPath && <button className="btn btn-secondary" onClick={() => setCoverPath(null)}>Remove</button>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>{isEditing ? 'Update' : 'Save'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
