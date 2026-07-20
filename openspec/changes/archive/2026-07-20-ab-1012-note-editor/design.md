## Context

AB-1011 delivered a read-only notes list page and explicitly deferred both the "create note" entry point and note-click navigation to this ticket (see its proposal's "What Changes": _"Notes are display-only in this ticket... both are AB-1012's scope"_). The backend already supports everything the editor needs: `POST /api/notes`, `GET /api/notes/:id`, and `PUT /api/notes/:id` accept/return TipTap JSON `content` plus `tagIds` (SDS §3.2.1/3.2.2/3.2.4), and `GET /api/tags` returns the user's tags (SDS §3.3.2, already consumed by `useTagsQuery` from AB-1011). No backend or shared-package change is required — this is a frontend-only ticket implementing FR-UI-EDITOR-001 and FR-UI-EDITOR-002.

TipTap v3 (`@tiptap/react` 3.28.0, `@tiptap/starter-kit` 3.28.0) and `dompurify` 3.4.12 are already pinned in `frontend/package.json` from AB-1001. Per `context7` (`/ueberdosis/tiptap-docs`), v3's `setContent` emits update events by default (a v2→v3 breaking change) and pasted-HTML sanitization is done via an `Extension`'s `transformPastedHTML(html)` hook, chained by extension `priority` — both are load-bearing for the decisions below.

## Goals / Non-Goals

**Goals:**

- Deliver `/notes/new` and `/notes/:id` editor routes with TipTap rich-text editing.
- Deliver the notes-list entry points deferred by AB-1011 (New Note action, clickable rows).
- Deliver 2s-debounced autosave with 1s/2s/4s retry backoff and save-state feedback, per SDS §11.3.
- Deliver an existing-tags picker and pasted-HTML sanitization.

**Non-Goals (explicitly out of scope for this ticket, per the approved proposal):**

- Tag creation/edit/delete UI (tag CRUD stays API-only).
- Deleting or restoring a note from the editor.
- Version history viewing/restoration (AB-1015).
- Search or sharing UI (AB-1013/AB-1014).
- Any backend, Prisma schema, or `packages/shared` changes.

## Decisions

### 1. Routing

Add `/notes/new` and `/notes/:id` to `AppRouter.tsx`, both wrapped in the existing `ProtectedRoute`, both rendering the same `NoteEditorPage` component. `NoteEditorPage` reads `useParams()` to distinguish "new" (no `:id` segment) from "edit" (`:id` present).

### 2. New-note creation flow

On mount for the "new" case, `NoteEditorPage` initializes a TipTap editor with empty content and immediately fires a `createNote` mutation (`POST /api/notes`) with `title: "Untitled"` and `content: editor.getJSON()` (letting TipTap produce its own valid empty-doc JSON rather than hand-constructing one). On success, the page stores the returned note `id` in local state and calls `navigate('/notes/${id}', { replace: true })` so the URL/bookmark is correct — this does **not** remount the editor or discard any content the user already typed during the brief creation round-trip, since the same `NoteEditorPage`/editor instance keeps running and just starts treating itself as the "edit" case once `id` is known. Autosave (below) only arms once this `id` exists.

If the initial `POST /api/notes` creation fails (e.g. network failure or 500 error), `NoteEditorPage` renders a visible error alert with a **Retry** button (re-attempting the `createNote` mutation) and a **Back to Notes** button navigating back to `/`, preventing the user from getting stranded on an uncreated note state.

### 3. Loading an existing note

For the "edit" case, `useNoteQuery(id)` (new hook, mirrors the existing `useNotesQuery` pattern) calls `GET /api/notes/:id`. On success, the fetched title/tags seed local state and `editor.commands.setContent(note.content, { emitUpdate: false })` loads the content. `emitUpdate: false` is required in TipTap v3 (confirmed via `context7`) — otherwise `setContent` fires an `onUpdate` event that the autosave hook would mistake for a real user edit immediately after load.

### 4. Data flow / TanStack Query

- `useNoteQuery(id)`: `GET /api/notes/:id`, query key `["notes", id]`.
- `useTagsQuery()`: reused as-is from AB-1011 for the tag picker's options.
- `createNote` / `updateNote`: TanStack mutations wrapping `POST /api/notes` / `PUT /api/notes/:id`. On success, both invalidate the `["notes"]` list query key (so the notes list reflects the change on return) and the `["notes", id]` detail key, per the cache-invalidation pattern in SDS §11.1.
- No new shared types: `createNoteRequestSchema`, `updateNoteRequestSchema`, `noteResponseSchema`, `tagListResponseSchema` (all already in `packages/shared`) cover every request/response shape needed.

### 5. Autosave hook

A new `useAutosave` hook encapsulates: a 2-second debounce timer restarted on every relevant change (title, content, selected tag IDs); a "last-saved snapshot" comparison (`JSON.stringify` of the normalized `{title, content, tagIds}`) to skip the `PUT` when nothing changed since the last successful save; and a retry loop of up to 3 attempts with 1s/2s/4s backoff on failure. Save/retry/error state lives in a new `EditorStore` (Zustand, per SDS §11.2: `status: "idle" | "saving" | "saved" | "retrying" | "error"`, `retryCount`). The editor footer reads this store to show a quiet "retrying…" indicator during retries and a visible error only once all retries are exhausted, and a "saved" indicator on success — satisfying FR-UI-EDITOR-002 without blocking typing.

### 6. Tag assignment

A `TagPicker` component lists the user's tags from `useTagsQuery()` as toggleable checkboxes/chips. Selected tag IDs are tracked in local component state (seeded from the loaded note's tags when editing) and included as `tagIds` in both the initial `createNote` call and every subsequent autosave payload. No tag-creation control is rendered (per the approved proposal's "Selection only" scope decision).

### 7. Pasted-content sanitization

A small custom TipTap `Extension` (e.g. `PasteSanitizeExtension`) implements `transformPastedHTML(html) { return DOMPurify.sanitize(html) }` and is added to the `extensions` array alongside `StarterKit`. This is the documented v3 mechanism for intercepting pasted HTML before ProseMirror parses it (confirmed via `context7`). Typed content and content loaded via `setContent` remain constrained to StarterKit's node schema (no raw-HTML node), so no separate sanitization is needed for those paths.

### 8. Entry points (AB-1011 deferral)

- `NotesListHeader.tsx`: add a "New Note" button calling `navigate("/notes/new")`.
- `NoteListItem.tsx`: wrap the existing `<li>` content so selecting a note navigates to `/notes/${note.id}` (e.g. via `react-router-dom`'s `Link` or an `onClick` + `navigate`), preserving its current visual layout.

### 9. Note-store scope

A minimal `NoteStore` (Zustand) tracks only `openNoteId` per SDS §11.2 — the editor's draft title/content/tags live in component state and the TipTap editor instance itself, not duplicated into Zustand (server state stays in TanStack Query per the frontend state-split rule in AGENTS.md §5).

### 10. Error handling for fetch failures

`useNoteQuery` failures (403/404/network, per SDS §3.2.3) are shown with a visible error message and a way back to the notes list — following the same alert+retry visual pattern already used on `NotesListPage`, not a new interaction pattern.

## Testing Strategy

- Frontend component tests (Vitest + React Testing Library + MSW), one uniquely named test per delta-spec scenario (12 scenarios total across the two FR-UI-EDITOR requirements plus the two entry-point scenarios), per NFR-003.
- Autosave debounce/skip-when-unchanged/retry-backoff behavior tested with `vi.useFakeTimers()`.
- Paste sanitization tested by dispatching a paste event containing a `<script>`/`onerror=` payload and asserting the sanitized result contains no executable markup.
- Manual smoke test (per NFR-003/AGENTS §10): create a note, edit its content and title, assign a tag, refresh mid-edit to confirm autosave persisted, and simulate an autosave failure (e.g. dev-tools offline) to confirm retry-then-error feedback.
- No backend or E2E tests in this ticket (E2E full-journey coverage is AB-1016).

## Quality Checkpoints

`pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`, run in that order after implementation, per AGENTS.md §4.3. No proceeding past a failing checkpoint.

## Risks / Trade-offs

- **[Risk]** Opening `/notes/new` and abandoning it immediately leaves an empty "Untitled" note in the user's list → **Mitigation**: accepted trade-off from the approved proposal (immediate-creation was the chosen option); the note behaves like any other note the user can edit or ignore, and existing purge jobs are unaffected since it was never soft-deleted.
- **[Risk]** TipTap v3's `setContent` emits an update by default, which could make the autosave hook mistake a programmatic content load for a user edit → **Mitigation**: always call `setContent` with `{ emitUpdate: false }` when loading fetched note content (confirmed via `context7` as the v3-required option).
- **[Risk]** A user could start typing during the brief window before the initial `POST /api/notes` for a new note resolves → **Mitigation**: the autosave debounce only arms once the created note's `id` is known; edits made in that window remain in the (single, non-remounted) editor instance and are captured by the first debounce cycle once `id` is set.
- **[Risk]** A custom `transformPastedHTML` sanitizer could interact unexpectedly with StarterKit's own paste handling → **Mitigation**: return the DOMPurify-sanitized HTML string unchanged in shape (a plain HTML string), matching the documented `context7` pattern, so ProseMirror's existing HTML paste parser consumes it exactly as it would any other pasted HTML.

## Migration Plan

Not applicable — frontend-only change, no Prisma schema changes, no database migration, no backend API changes.

## Open Questions

None outstanding — scope ambiguities (new-note creation timing/default title, tag-assignment scope, delete-in-editor scope, sanitization scope) were resolved during `/spec` clarification and are reflected in the approved proposal and delta spec.
