import { useState, useEffect } from 'react';
import { X, Plus, Pencil, Check, Trash2 } from 'lucide-react';
import type { Quote } from '../lib/db';
import { getQuotes, addQuote, updateQuote, deleteQuote } from '../lib/db';

interface QuoteEditorModalProps {
    onClose: () => void;
    onChanged: () => void;
}

export default function QuoteEditorModal({ onClose, onChanged }: QuoteEditorModalProps) {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [newText, setNewText] = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        const q = await getQuotes();
        setQuotes(q);
    }

    async function handleAdd() {
        if (!newText.trim()) return;
        await addQuote(newText.trim());
        setNewText('');
        await load();
        onChanged();
    }

    async function handleSaveEdit() {
        if (!editingId || !editText.trim()) return;
        await updateQuote(editingId, editText.trim());
        setEditingId(null);
        setEditText('');
        await load();
        onChanged();
    }

    async function handleDelete(id: string) {
        await deleteQuote(id);
        await load();
        onChanged();
    }

    function startEdit(q: Quote) {
        setEditingId(q.id);
        setEditText(q.text);
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0 }}>Edit Quotes</h2>
                    <button className="btn-icon" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="quote-list">
                    {quotes.map(q => (
                        <div key={q.id} className="quote-list-item">
                            {editingId === q.id ? (
                                <div className="quote-edit-row">
                                    <input
                                        value={editText}
                                        onChange={e => setEditText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                        autoFocus
                                    />
                                    <button className="btn-icon" onClick={handleSaveEdit}><Check size={16} /></button>
                                    <button className="btn-icon" onClick={() => setEditingId(null)}><X size={16} /></button>
                                </div>
                            ) : (
                                <div className="quote-display-row">
                                    <span className="quote-text">{q.text}</span>
                                    <div className="quote-actions">
                                        <button className="btn-icon" onClick={() => startEdit(q)}><Pencil size={14} /></button>
                                        <button className="btn-icon" onClick={() => handleDelete(q.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="quote-add-row">
                    <input
                        value={newText}
                        onChange={e => setNewText(e.target.value)}
                        placeholder="Add a new quote…"
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                    />
                    <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '8px 16px' }}>
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>
        </div>
    );
}
