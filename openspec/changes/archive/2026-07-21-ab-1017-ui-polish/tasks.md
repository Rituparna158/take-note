## 1. TipTap Editor Toolbar Component

- [x] 1.1 Create `frontend/src/features/notes/EditorToolbar.tsx` with formatting buttons for Bold, Italic, Strike, Code, Heading 1/2/3, Bullet List, Numbered List, Blockquote, Code Block, Undo, and Redo using TipTap chain commands and active state toggles.
- [x] 1.2 Add `frontend/src/features/notes/EditorToolbar.test.tsx` unit tests asserting formatting buttons invoke TipTap editor commands.

## 2. Note Editor Page Layout & Title Polish

- [x] 2.1 Update `frontend/src/features/notes/NoteEditorPage.tsx` to render `<EditorToolbar editor={editor} />` above `<EditorContent editor={editor} />`.
- [x] 2.2 Polish the title input in `NoteEditorPage.tsx` with placeholder `"Note title..."`, modern typography, focus rings, while preserving `aria-label="Note title"`.
- [x] 2.3 Polish the editor container and action buttons (Share, History, TagPicker) with clean Tailwind card styling.
- [x] 2.4 Update the autosave status badge to display `"Syncing changes..."`, `"All changes saved"`, and `"Sync failed — Retrying..."`.

## 3. Trash / Soft-Delete Recovery UI

- [x] 3.1 Add `GET /api/notes/trash` to `backend/src/routes/notes.ts`, backed by `listSoftDeletedNotes` in `backend/src/services/noteService.ts` (mirrors `listActiveNotes`, filters `deletedAt: { not: null }`).
- [x] 3.2 Add `backend/src/routes/notes.trash.test.ts` covering: user's own trashed notes are returned, active notes are excluded, another user's trashed notes are excluded.
- [x] 3.3 Add `frontend/src/features/notes/TrashPage.tsx` (route `/trash`), `useTrashNotesQuery.ts`, `useRestoreNoteMutation.ts`, and a "Trash" link in `NotesListHeader.tsx`.
- [x] 3.4 Add an `onDelete` prop to `NoteListItem.tsx` (Delete button with `title` attribute, not `aria-label`, to avoid Playwright `getByLabel` substring collisions with tag-filter checkboxes) and wire it up via `useDeleteNoteMutation.ts` in `NotesListPage.tsx` with a `window.confirm` guard.
- [x] 3.5 Add `frontend/src/features/notes/TrashPage.test.tsx` covering loading, empty state, listing, restore, error/retry, and back-navigation.
- [x] 3.6 Add delete-note coverage to `NotesListPage.test.tsx` (confirm-then-delete removes the note; declining confirmation keeps it).

## 4. Tag Creation UI

- [x] 4.1 Add inline tag creation ("+ Add Tag") to `TagPicker.tsx` via `frontend/src/features/tags/useCreateTagMutation.ts`, posting to the existing `POST /api/tags` and auto-selecting the new tag.
- [x] 4.2 Add `frontend/src/features/notes/TagPicker.test.tsx` covering tag creation and blank-name rejection.

## 5. Public Share View Page

- [x] 5.1 Add `frontend/src/features/notes/PublicSharePage.tsx` (route `/share/:token` in `AppRouter.tsx`), rendering the existing `GET /api/share/:token` response as read-only sanitized TipTap content.
- [x] 5.2 Add `frontend/src/features/notes/PublicSharePage.test.tsx` covering valid and invalid/expired/revoked share tokens.

## 6. Share Link Status Refresh & Copy

- [x] 6.1 Add `GET /api/notes/:id/share` to `backend/src/routes/share.ts`, backed by `getActiveShareLink` in `backend/src/services/shareService.ts` (reuses `findOwnedNoteOrThrow` for 403/404 semantics; 404 when no active link exists).
- [x] 6.2 Add `backend/src/routes/share.status.test.ts` covering: active link status returned, view count reflects public views, 404 with no link, 404 when revoked, 403 for non-owner.
- [x] 6.3 Add "Copy Link" and "Refresh Views" controls to `ShareModal.tsx`, using `shareApi.ts`'s new `getShareLinkStatus`.
- [x] 6.4 Add Refresh Views / Copy Link coverage to `ShareModal.test.tsx`.

## 7. Quality Gates Verification

- [x] 7.1 Run `pnpm build` — 0 errors, 0 warnings.
- [x] 7.2 Run `pnpm lint --max-warnings 0`.
- [x] 7.3 Run `pnpm test` — all unit, component, integration, and E2E tests pass 100% green.
