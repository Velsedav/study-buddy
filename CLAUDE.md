# Study Buddy — Claude Code Guidelines

## Styling Rules

### No inline `style={{}}` in JSX

**Rule:** All styling must live in `.css` files as named classes. Do NOT add inline `style={{}}` attributes to JSX elements.

**Why this exists:** Inline styles scatter visual logic across component files, make theming impossible, and create inconsistency. This project uses a glassmorphism CSS design system — extend it in CSS, not in JSX.

**The only exceptions (truly dynamic values):**
- CSS custom properties whose values are computed at runtime:
  ```tsx
  // OK — only a CSS variable value is inline
  <span style={{ '--badge-bg': FOCUS_TYPE_COLORS[ch.focusType] } as React.CSSProperties} />
  ```
- Pixel values computed from runtime data (e.g. drag resize heights):
  ```tsx
  // OK — can't be statically expressed in CSS
  <div style={{ '--block-height': `${heightPx}px` } as React.CSSProperties} />
  ```

**Not OK — these must go to CSS:**
```tsx
// ❌ Move these to CSS classes
<div style={{ display: 'flex', gap: '8px', marginTop: '24px' }} />
<span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-muted)' }} />
<button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }} />
```

**Process when touching a component:**
1. Create (or reuse) a `ComponentName.css` file in the same directory as the `.tsx` file.
2. Import it: `import './ComponentName.css';`
3. Move every `style={{}}` block to a descriptive CSS class.
4. Use conditional `className` strings for variant logic (selected, active, sub-chapter, etc.).
5. For truly dynamic values, use `--css-custom-property` via inline style, consumed by CSS `var()`.

---

## Language & Translations

UI-facing strings must go through the i18n system. **Never hardcode user-visible text directly in JSX.**

### How the i18n system works

Translation keys live in `src/lib/i18n.ts` inside the `pt` object, keyed by language code (`en`, `fr`, `es`). The `useTranslation()` hook returns a `t('key')` function.

```tsx
import { useTranslation } from '../lib/i18n';

const { t } = useTranslation();
// In JSX:
<label>{t('home.tag')}</label>
```

### Rule: every time you add or modify user-facing text

1. **Add the key** to all three language sections (`en`, `fr`, `es`) in `src/lib/i18n.ts`.
2. **Use `t('key')`** in JSX — never a raw string literal for UI text.
3. **French is primary** — if you're unsure of a translation, write it in French for `fr` and add a note; do not leave it in English.
4. **Naming convention**: `page.description_of_string` (e.g. `plan.select_chapter`, `session.break_checklist_water`).

### Untranslated text

If you encounter hardcoded text in existing JSX (strings not going through `t()`), flag it and add the keys. This is a known gap in the codebase — fix it whenever you touch the file.

---

## Accessibility

- All modals: `role="dialog" aria-modal="true" aria-labelledby="<title-id>"`
- Close buttons: `className="btn-icon" aria-label="Fermer"` (no inline padding)
- Keyboard: `Escape` closes modals/menus; `:focus-visible` for focus rings
- Hidden action buttons: always in DOM, shown via CSS `opacity`/`:hover`/`:focus-within` — not JS conditional rendering
- Dropdowns: `aria-haspopup="true" aria-expanded={...}` on trigger; `role="menu"` on list; `role="menuitem"` on items
- No `alert()` — use inline error state displayed in the UI

---

## CSS Custom Properties (theme tokens)

Use these — never hardcode color values:

| Token | Purpose |
|---|---|
| `--primary` | Brand accent |
| `--primary-rgb` | RGB tuple for `rgba()` usage |
| `--text-dark` | Main text |
| `--text-muted` | Secondary text (`#6e6878`) |
| `--card-bg` | Card background |
| `--glass-border` | Glassmorphism border |
| `--border-radius` | Standard radius |
| `--success` | Green/positive |
| `--danger` | Red/destructive |
| `--accent` | Secondary accent |
