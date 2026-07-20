## Why

Users can currently only create, view, and edit notes via the raw API — `POST/GET/PUT /api/notes` (AB-1004) already support rich-text (TipTap JSON) content and tag assignment, but no frontend surface exists to use them. AB-1011 explicitly deferred both the "create note" entry point and note-click navigation to this ticket. This ticket delivers the rich-text note editor and its entry points, giving users their first way to actually create and edit note content.

## What Changes

- Add a note editor page reachable at two routes inside the existing `ProtectedRoute` wrapper: `/notes/new` (create) and `/notes/:id` (edit an existing active note).
- Add entry points into the editor from the notes list page (deferred by AB-1011): a "New Note" action in the header/nav area, and make each note list item navigate to `/notes/:id` on click.
- Opening `/notes/new` immediately calls `POST /api/notes` with a default title (`"Untitled"`) and an empty TipTap document, then the page continues as the edit view for the newly created note (subsequent saves use `PUT /api/notes/:id`).
- Opening `/notes/:id` fetches the note via `GET /api/notes/:id` and loads its existing title, TipTap content, and assigned tags into the editor.
- Rich-text editing via `@tiptap/react` + `@tiptap/starter-kit` (already pinned in AB-1001), rendering the note's TipTap JSON as editable content.
- Autosave: after exactly 2 seconds of editor inactivity following a real change, `PUT /api/notes/:id` is called with the current title, content, and tag IDs; autosave is skipped when nothing has changed since the last saved snapshot. A failed autosave is automatically retried up to 3 times with 1s/2s/4s backoff; a visible error is shown only once retries are exhausted, and a quiet non-blocking "retrying" indicator is shown during retries. The user can identify when the note is in a successfully saved state.
- Tag assignment: a tag picker sourced from `GET /api/tags` lets the user assign/unassign existing tags on the note; selected tag IDs are included in the create/update payload. No tag-creation UI is added by this ticket — tag CRUD remains API-only until a future ticket, if any, adds one.
- Content safety: pasted HTML content is sanitized with DOMPurify inside TipTap's paste-transform step before insertion. Typed content and content loaded from the API are already constrained by StarterKit's node schema (no raw-HTML node), which the editor relies on to prevent unsafe content from executing.
- Deleting a note is explicitly out of scope for this ticket — the editor only creates, reads, and updates notes.
- All request/response shapes are consumed as-is from the existing `packages/shared` schemas (`createNoteRequestSchema`, `updateNoteRequestSchema`, `noteResponseSchema`, `tagListResponseSchema`) — no new shared types are introduced.

## Capabilities

### New Capabilities

- `note-editor-ui`: Frontend rich-text note editor — create-note and edit-note routes, TipTap-based editing, debounced autosave with retry/error feedback, existing-tag assignment, pasted-content sanitization, and the notes-list entry points (New Note action, clickable note rows) deferred from AB-1011.

### Modified Capabilities

_None — this ticket only adds a frontend UI on top of the existing `note-management` (AB-1004) and `tag-management` (AB-1006) backend capabilities; no backend requirement changes. The notes-list entry points are new behavior specified under `note-editor-ui` (as anticipated by AB-1011's proposal), not an edit to `notes-list-ui`'s own spec text._

## Impact

- **New frontend code**: note editor page component, TipTap editor wrapper/hook, autosave hook (debounce + retry/backoff), tag picker component, `EditorStore` (Zustand — editor instance, autosave/retry state) and `NoteStore` (Zustand — open note id/draft) per SDS §11.2, and `notesApi` additions (`getNote`, `createNote`, `updateNote`).
- **Modified frontend code**: `AppRouter.tsx` (new `/notes/new` and `/notes/:id` routes), `NotesListHeader.tsx` (New Note action), `NoteListItem.tsx` (navigates to `/notes/:id` on click).
- **No backend or shared-package API changes** — consumes the existing `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, and `GET /api/tags` endpoints and existing shared DTOs/schemas as-is.
