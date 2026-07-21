## Why

While all core functionalities across AB-1001 through AB-1016 are implemented and fully verified, the note editor lacks a visual TipTap formatting toolbar (Bold, Italic, Headings, Lists, Blockquotes, Code Blocks, Undo, Redo) and polished UX elements (dynamic autosave status pill, modern title input placeholder, skeleton loading states, and card containers). AB-1017 introduces these visual enhancements, fulfilling `UX.md` conventions.

During implementation, three previously known UI gaps were also closed as part of this ticket: the trash/soft-delete recovery UI (deleting/restoring notes had no UI, only backend support from AB-1004), the tag-creation UI (`POST /api/tags` had no UI entry point since AB-1006), and the public share view page (`GET /api/share/:token` had no rendering page since AB-1008). Closing these required two small new read-only backend endpoints (`GET /api/notes/trash`, `GET /api/notes/:id/share`) to support listing trashed notes and refreshing share-link status in the UI — no schema changes.

## What Changes

- Add a visual `EditorToolbar.tsx` component above the TipTap editor canvas in `NoteEditorPage.tsx` supporting:
  - Text styles: Bold, Italic, Strike, Code.
  - Headings: H1, H2, H3.
  - Lists: Bullet list, Numbered list.
  - Blocks: Blockquote, Code block.
  - Actions: Undo, Redo.
- Update `NoteEditorPage.tsx` title input with a clean placeholder (`placeholder="Note title..."`), defaulting to empty if untitled, styled with modern typography and focus rings.
- Add an Editor Autosave Status Pill displaying `"Syncing changes..."` (with spinner), `"All changes saved"`, and `"Sync failed — Retrying..."` (with retry button).
- Improve Notes List and Search UI with modern card containers, skeleton screens, and rich empty states.
- Add a Trash Bin page (`TrashPage.tsx`, route `/trash`) listing soft-deleted notes with a Restore Note action, and wire a Delete action into `NoteListItem.tsx` on the active notes list. Backed by the new `GET /api/notes/trash` endpoint and the existing `DELETE /api/notes/:id` / `POST /api/notes/:id/restore` endpoints (AB-1004).
- Add inline tag creation to `TagPicker.tsx` via a "+ Add Tag" control, using the existing `POST /api/tags` endpoint (AB-1006).
- Add a public, unauthenticated share view page (`PublicSharePage.tsx`, route `/share/:token`) rendering a shared note's sanitized read-only content via the existing `GET /api/share/:token` endpoint (AB-1008).
- Add "Copy Link" and "Refresh Views" controls to `ShareModal.tsx`, backed by a new `GET /api/notes/:id/share` endpoint returning the note owner's active share link status.
- Retain all test-contract attributes (`aria-label="Note title"`, `role="dialog"`, `role="alert"`, `Share`, `History`) so all previously passing automated tests remain green, and add new automated tests covering every feature above.

## Capabilities

### New Capabilities

- `ui-polish`: Frontend TipTap editor formatting toolbar, autosave status pill, skeleton loaders, modern visual UI enhancements per `UX.md`, and the trash/tag-creation/public-share UI gaps closed in this ticket.

### Modified Capabilities

- `note-editor`: Enhanced with visual formatting toolbar and improved title input layout.
- `note-management`: New `GET /api/notes/trash` endpoint (`listSoftDeletedNotes`) to support the Trash Bin UI.
- `note-sharing`: New `GET /api/notes/:id/share` endpoint (`getActiveShareLink`) to support the share-status refresh UI.

## Impact

- **Affected code**:
  - `frontend/src/features/notes/EditorToolbar.tsx` (new), `NoteEditorPage.tsx`, `NotesListPage.tsx`, `NoteListItem.tsx`, `TagPicker.tsx`, `ShareModal.tsx`, `notesApi.ts`, `shareApi.ts`.
  - New: `frontend/src/features/notes/TrashPage.tsx`, `PublicSharePage.tsx`, `useDeleteNoteMutation.ts`, `useRestoreNoteMutation.ts`, `useTrashNotesQuery.ts`, `frontend/src/features/tags/useCreateTagMutation.ts`.
  - `frontend/src/routes/AppRouter.tsx`: routes for `/trash` and `/share/:token`.
  - `backend/src/routes/notes.ts` (+`GET /trash`), `backend/src/routes/share.ts` (+`GET /`), `backend/src/services/noteService.ts` (+`listSoftDeletedNotes`), `backend/src/services/shareService.ts` (+`getActiveShareLink`).
- **Shared types**: untouched.
- **Backend / DB**: two new read-only endpoints added to existing routers/services; no new Prisma migrations or schema changes.
