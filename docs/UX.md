# UX Conventions (`UX.md`)

## Global Frontend User Experience & Visual Design Architecture

> **Global conventions for all frontend user experience enhancements (`AB-1010` to `AB-1017`).**  
> Traceability: Fully aligned with `docs/FRS.md` (§15 Frontend Requirements), `AGENTS.md`, and `docs/SDS.md`.

---

## 1. TipTap Editor Formatting Toolbar (`[FR-UI-EDITOR-001]`)

- **Visual Formatting Bar**: The TipTap rich-text editor SHALL render a visual formatting toolbar (`EditorToolbar.tsx`) above the editor canvas.
- **Formatting Actions**:
  - **Text Styling**: Bold (`B`), Italic (`I`), Strike (`S`), Code (`</>`).
  - **Headings**: Heading 1 (`H1`), Heading 2 (`H2`), Heading 3 (`H3`).
  - **Lists**: Bullet List (`• List`), Numbered List (`1. List`).
  - **Blocks**: Blockquote (`" Quote`), Code Block (`{ } Code`).
  - **History**: Undo (`↶`), Redo (`↷`).
- **Active State Indication**: Toolbar buttons MUST reflect active editor marks/nodes dynamically (`editor.isActive('bold')`, etc.) with high-contrast active styling.

---

## 2. Loading States & Skeletons (`[FR-UI-1]`)

- **Responsive Feedback (`<100ms`)**: Every asynchronous user action MUST trigger a visual loading indicator within 100ms of initiation.
- **Button Loading Actions**: When action buttons (e.g., `"Create Note"`, `"Log In"`, `"Restore"`, `"Share"`) are clicked, replace text/icon labels with an animated spinner (`<Loader2 className="animate-spin" />`). Keep button dimensions stable.
- **Skeleton Screens**: Render professional skeleton screens matching content layout while loading lists (`GET /api/notes`, `GET /api/tags`).
- **Minimum Display Timer (`>=200ms`)**: Loading spinners/skeletons MUST remain visible for at least 200ms to eliminate visual flicker.

---

## 3. Editor Autosave Indicator & Status Pill (`[FR-UI-EDITOR-002]`)

- **Autosave Status Pill**: The editor toolbar displays a dynamic status pill:
  - `saving`: Displays an animated sync indicator with `"Syncing changes..."`.
  - `saved`: Displays `"All changes saved"` and fades smoothly.
  - `error`: Displays `"Sync failed — Retrying..."` with a manual click-to-retry button.

---

## 4. Error States & Exception Handling

- **Centralized Error Handling**: API errors MUST map directly to user-facing copy via `errorMessages.ts`.
- **Zero Raw Error Exposure**: Never expose raw stack traces or internal database errors.
- **Inline Validation**: Show inline validation errors directly below affected input fields in red (`text-red-500 text-xs mt-1`).
- **Dismissible Alerts**: Action errors present clear, dismissible alert messages with primary recovery actions (`"Retry"`, `"Back to Notes"`).

---

## 5. Rich Empty States

Every empty list MUST render a visual empty state:

- **Visual Composition**:
  - **Icon**: Subtle monochrome icon (`FileText`, `Tags`, `Share2`, `Search`).
  - **Heading**: Resource-specific heading (`"No notes yet"`, `"No tags yet"`).
  - **Subtext**: Friendly prompt guiding the user.
  - **Primary CTA Button**: Prominent button initiating creation (`"+ Create your first note"`).

---

## 6. Accessibility & Contrast (`WCAG AA`)

- **Keyboard Operability**: All interactive buttons, inputs, and modals MUST be keyboard-reachable (`Tab` and `Shift+Tab`).
- **Semantic ARIA Labels**: Every form input field MUST have an associated `<label>` or `aria-label`. Icon-only buttons MUST include clear `aria-label` descriptions.
- **Visible Focus Rings**: Provide high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-slate-900`).
- **WCAG AA Contrast**: Text and icons MUST satisfy minimum contrast requirements (`4.5:1` body text, `3:1` UI boundaries).
