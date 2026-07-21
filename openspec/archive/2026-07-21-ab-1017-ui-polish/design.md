## Context

AB-1001 through AB-1016 implemented and verified all core functionalities across frontend and backend. AB-1017 builds the `EditorToolbar.tsx` component, applies UX enhancements per `UX.md`, and closes three UI gaps left over from earlier tickets: soft-delete/trash has no UI (AB-1004 built the backend only), tag creation has no UI (AB-1006 built the backend only), and public share links have no rendering page (AB-1008 built the backend only).

## Goals / Non-Goals

**Goals:**

- Build `EditorToolbar.tsx` with TipTap chain commands (`editor.chain().focus().toggleBold().run()`, etc.) and active state indicators (`editor.isActive('bold')`).
- Integrate `EditorToolbar.tsx` into `NoteEditorPage.tsx`.
- Refactor title input styling with placeholder `"Note title..."` while preserving `aria-label="Note title"`.
- Upgrade autosave status rendering with animated syncing indicators and retry buttons.
- Build a Trash Bin page and wire delete/restore actions, backed by a new `GET /api/notes/trash` endpoint.
- Build inline tag creation in `TagPicker.tsx` against the existing `POST /api/tags` endpoint.
- Build a public share view page against the existing `GET /api/share/:token` endpoint.
- Add copy-link and view-count-refresh controls to `ShareModal.tsx`, backed by a new `GET /api/notes/:id/share` endpoint.
- Preserve 100% test compatibility for all previously passing unit, component, and E2E tests, and add new tests for every feature listed above.

**Non-Goals:**

- No Prisma schema changes or new migrations.
- No new write endpoints — the two new backend endpoints added (`GET /api/notes/trash`, `GET /api/notes/:id/share`) are both read-only, reusing existing soft-delete/share-link data and access-control logic (`findOwnedNoteOrThrow`).

## Decisions

1. **`EditorToolbar.tsx` component**:
   - Accepts `editor: Editor | null` prop.
   - Renders visual formatting buttons for Bold, Italic, Strike, Code, H1, H2, H3, Bullet List, Ordered List, Blockquote, Code Block, Undo, Redo.
   - Styled with Tailwind flex row, border dividers, and subtle rounded hover/active states (`bg-slate-200` for active formatting).

2. **`NoteEditorPage.tsx` integration**:
   - Renders `<EditorToolbar editor={editor} />` above `<EditorContent editor={editor} />`.
   - Title input styled as a prominent header (`text-3xl font-bold`) with placeholder `"Note title..."` and `aria-label="Note title"`.
   - Card container: `bg-white shadow-sm border border-slate-200 rounded-xl p-6`.

3. **Status Pill**:
   - Renders autosave state with clean status badges and retry controls.

4. **Trash / soft-delete recovery UI**:
   - `notesRouter.get("/trash", ...)` (registered before `/:id` to avoid path collision) calls `listSoftDeletedNotes(userId, query)`, mirroring `listActiveNotes` but filtering `deletedAt: { not: null }` and ordering by `updatedAt desc`.
   - `NoteListItem.tsx` gains an optional `onDelete` prop; its Delete button uses a `title` attribute (not `aria-label`) for the tooltip text so it can't collide with tag-filter checkbox labels that Playwright's `getByLabel` matches by substring.
   - `NotesListPage.tsx` wires the delete button to `window.confirm` + `useDeleteNoteMutation`.
   - `TrashPage.tsx` (route `/trash`, linked from `NotesListHeader.tsx`) lists soft-deleted notes via `useTrashNotesQuery` and restores them via `useRestoreNoteMutation`, invalidating the `["notes"]` query key on success.

5. **Tag creation UI**:
   - `TagPicker.tsx` gains inline create state (`isCreating`/`newTagName`) and `useCreateTagMutation`, posting to the existing `POST /api/tags` and auto-selecting the new tag via `onToggleTag`.

6. **Public share view page**:
   - `PublicSharePage.tsx` (route `/share/:token`) fetches `GET /api/share/:token` directly (no auth), renders a read-only TipTap `EditorContent` with the existing `PasteSanitizeExtension`, and shows a dedicated "Unable to view note" state for expired/revoked/nonexistent tokens.

7. **Share link status refresh**:
   - `getActiveShareLink(userId, noteId)` in `shareService.ts` reuses `findOwnedNoteOrThrow(userId, noteId, "active")` for the same 403/404 ownership semantics as `generateShareLink`/`revokeShareLink`, then looks up the newest non-revoked, unexpired `ShareLink` row.
   - `noteShareRouter.get("/", ...)` returns 404 `NOT_FOUND` when no active link exists (never generated, revoked, or expired) — the frontend never needs to distinguish those three cases.
   - `ShareModal.tsx`'s "Refresh Views" button calls this endpoint on demand (not polled) to update `viewCount`/`expiresAt`/`revoked`; "Copy Link" writes the current link to `navigator.clipboard`.
