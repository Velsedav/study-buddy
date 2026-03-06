import { useState, useRef, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Tag } from '../lib/db';
import { getAllTags, getDb } from '../lib/db';

interface TagPickerProps {
    selectedTags: string[];
    onChange: (tags: string[]) => void;
}

export default function TagPicker({ selectedTags, onChange }: TagPickerProps) {
    const [query, setQuery] = useState('');
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadTags();
    }, []);

    async function loadTags() {
        try {
            const tags = await getAllTags();
            setAllTags(tags);
        } catch (e) {
            console.error(e);
        }
    }

    // Close dropdown on click outside
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const normalizedQuery = query.trim().toLowerCase();

    // Existing tags that match the query and aren't already selected
    const suggestions = allTags.filter(
        t => !selectedTags.includes(t.name) &&
            t.name.includes(normalizedQuery)
    );

    // Show "Create X" if query doesn't exactly match any existing tag
    const canCreate = normalizedQuery.length > 0 &&
        !allTags.some(t => t.name === normalizedQuery) &&
        !selectedTags.some(t => t.toLowerCase() === normalizedQuery);

    // Build the full options list (suggestions + optional create)
    const options: { type: 'select' | 'create'; label: string; tag?: Tag }[] = [
        ...suggestions.map(t => ({ type: 'select' as const, label: t.name, tag: t })),
        ...(canCreate ? [{ type: 'create' as const, label: normalizedQuery }] : []),
    ];

    // Reset highlight when options change
    useEffect(() => {
        setHighlightIdx(0);
    }, [normalizedQuery, suggestions.length, canCreate]);

    // Scroll highlighted option into view
    useEffect(() => {
        if (!isOpen || !dropdownRef.current) return;
        const el = dropdownRef.current.children[highlightIdx] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx, isOpen]);

    function selectTag(tagName: string) {
        onChange([...selectedTags, tagName]);
        setQuery('');
        setHighlightIdx(0);
        inputRef.current?.focus();
    }

    function removeTag(tagName: string) {
        onChange(selectedTags.filter(t => t !== tagName));
    }

    async function deleteTagFromDb(tag: Tag) {
        try {
            const db = await getDb();
            await db.execute(`DELETE FROM subject_tags WHERE tag_id = $1`, [tag.id]);
            await db.execute(`DELETE FROM tags WHERE id = $1`, [tag.id]);
            // Remove from local state
            setAllTags(prev => prev.filter(t => t.id !== tag.id));
            // Also remove from selected if present
            if (selectedTags.includes(tag.name)) {
                onChange(selectedTags.filter(t => t !== tag.name));
            }
        } catch (e) {
            console.error('Failed to delete tag:', e);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightIdx(i => Math.min(i + 1, options.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && options.length > 0 && highlightIdx < options.length) {
                const opt = options[highlightIdx];
                selectTag(opt.label);
            } else if (canCreate) {
                selectTag(normalizedQuery);
            }
        } else if (e.key === 'Backspace' && query === '' && selectedTags.length > 0) {
            removeTag(selectedTags[selectedTags.length - 1]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    }

    return (
        <div className="tag-picker" ref={containerRef}>
            <div
                className="tag-picker-input-area"
                onClick={() => { inputRef.current?.focus(); setIsOpen(true); }}
            >
                {selectedTags.map(tag => (
                    <span key={tag} className="tag-chip">
                        {tag}
                        <button
                            type="button"
                            className="tag-chip-remove"
                            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    className="tag-picker-input"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedTags.length === 0 ? 'Select or create tags…' : ''}
                />
            </div>

            {isOpen && options.length > 0 && (
                <div className="tag-picker-dropdown" ref={dropdownRef}>
                    {options.map((opt, idx) => (
                        <div
                            key={opt.type === 'create' ? '__create__' : opt.tag!.id}
                            className={`tag-picker-option ${idx === highlightIdx ? 'highlighted' : ''} ${opt.type === 'create' ? 'tag-picker-create' : ''}`}
                        >
                            <button
                                type="button"
                                className="tag-picker-option-label"
                                onClick={() => selectTag(opt.label)}
                                onMouseEnter={() => setHighlightIdx(idx)}
                            >
                                {opt.type === 'create' ? (
                                    <>Create <span className="tag-chip-preview">{opt.label}</span></>
                                ) : opt.label}
                            </button>
                            {opt.type === 'select' && opt.tag && (
                                <button
                                    type="button"
                                    className="tag-option-delete"
                                    title="Delete this tag"
                                    onClick={(e) => { e.stopPropagation(); deleteTagFromDb(opt.tag!); }}
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
