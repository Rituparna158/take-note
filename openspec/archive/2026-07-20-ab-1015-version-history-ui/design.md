## Context

`NoteEditorPage.tsx` already integrates one similar "open a panel over the editor for a secondary note operation" feature: `ShareModal.tsx`, wired via a toolbar button, its own API module (`shareApi.ts`), and dedicated TanStack Query mutation hooks (`useGenerateShareLinkMutation`, `useRevokeShareLinkMutation`). AB-1015 adds an analogous, but read/preview/restore-oriented, feature backed by the version endpoints already implemented in AB-1009 (`backend/src/routes/versions.ts`) and already typed in `packages/shared/src/notes/schemas.ts` (`NoteVersionListItem`, `NoteVersionDetail`, `RestoreVersionResponse`). No backend or shared-package work is needed — this is a frontend-only ticket.

The one integration wrinkle not present in the Share flow: restoring a version writes directly to the note via `POST /api/notes/:id/versions/:versionId/restore`, and the editor page's autosave (`useAutosave`, 2s debounce) compares live editor state against a `persistedSnapshot` baseline to decide whether a save is "needed" (`NoteEditorPage.tsx:92-102`). If that baseline isn't updated after a restore, the autosave effect will see the restored content as an unsaved diff against the stale baseline and fire a redundant `PUT /api/notes/:id`, creating an unwanted extra version on top of the one the restore already created.

## Goals / Non-Goals

**Goals:**

- Let a note owner open a version-history drawer from the note editor, list historical versions, preview one read-only, and restore it — satisfying FR-UI-VER-001 and FR-UI-VER-002 exactly as scoped in the approved proposal and delta spec.
- Reuse existing shared DTOs, `apiClient`, and TanStack Query/Zustand conventions without introducing new patterns.
- Ensure restoring a version does not trigger a spurious follow-up autosave PUT.

**Non-Goals:**

- No backend, Prisma, or `packages/shared` changes (all DTOs and endpoints already exist from AB-1009).
- No diffing/comparison UI between versions — the drawer previews one version at a time, per the delta spec.
- No pagination of the version list — `GET /api/notes/:id/versions` returns a plain array (SDS §3.6.1), so the drawer renders it as a single scrollable list.
- No changes to tag handling — `RestoreVersionResponse` (SDS §3.6.3) carries only `id`/`title`/`content`/`version`, so restore does not touch the note's tag associations.

## Decisions

**1. New `versionsApi.ts` module, mirroring `shareApi.ts`.**
Three thin functions in `frontend/src/features/notes/versionsApi.ts`, each calling `apiRequest` and parsing with the existing shared schemas (no new validation code):

- `getNoteVersions(noteId): Promise<NoteVersionListItem[]>` → `GET /api/notes/:id/versions`, parsed with `z.array(noteVersionListItemSchema)`.
- `getNoteVersion(noteId, versionId): Promise<NoteVersionDetail>` → `GET /api/notes/:id/versions/:versionId`, parsed with `noteVersionDetailSchema`.
- `restoreNoteVersion(noteId, versionId): Promise<RestoreVersionResponse>` → `POST /api/notes/:id/versions/:versionId/restore`, parsed with `restoreVersionResponseSchema`.

Alternative considered: folding these into `notesApi.ts`. Rejected to keep the sharing/versions/notes concerns separated the same way `shareApi.ts` is already split out.

**2. Three small hooks, mirroring the Share hooks.**

- `useNoteVersionsQuery(noteId, { enabled })` — `useQuery`, `queryKey: ["notes", noteId, "versions"]`, enabled only while the drawer is open (avoids fetching before the user opens it).
- `useNoteVersionQuery(noteId, versionId, { enabled })` — `useQuery`, `queryKey: ["notes", noteId, "versions", versionId]`, enabled only once a version is selected.
- `useRestoreVersionMutation(noteId)` — `useMutation`, calling `restoreNoteVersion`; `onSuccess` invalidates `["notes", noteId]` (note detail), `["notes"]` (paginated list, since `updatedAt` changes), and `["notes", noteId, "versions"]` (the timeline now has one more entry) — same invalidation shape as `useUpdateNoteMutation`.

**3. `VersionHistoryDrawer` component, structurally modeled on `ShareModal` but presented as a side drawer.**
`frontend/src/features/notes/VersionHistoryDrawer.tsx`, props `{ noteId, open, onClose, onRestored }`:

- `role="dialog" aria-modal="true" aria-label="Version history"`, positioned as a right-side slide-in panel (`fixed inset-y-0 right-0`) rather than `ShareModal`'s centered overlay — this matches the FRS/SDS's explicit "drawer" terminology and visually distinguishes a read-heavy, potentially longer-lived panel from the short-lived Share modal.
- Internal state: `selectedVersionId: string | null`.
- Lists items from `useNoteVersionsQuery`; each item is a button showing `Version {n} — {savedAt formatted like ShareModal's formatDate}`; clicking sets `selectedVersionId`.
- When `selectedVersionId` is set, renders the selected version's title and content read-only via `useNoteVersionQuery`, plus a `Restore version {n}` button.
- **Read-only content rendering**: instantiate a second TipTap `useEditor` instance scoped to the drawer, configured `editable: false` with the same `extensions: [StarterKit, PasteSanitizeExtension]` as the live editor, and call `setContent` when the fetched version's content changes. This reuses the exact same sanitized rendering path as the live editor instead of introducing a new `dangerouslySetInnerHTML` + DOMPurify path (as search snippets use) for note content — content authored via the note editor should only ever render through the same TipTap pipeline that constrains it, per AGENTS.md §11 ("Do NOT execute user-generated rich-text content unsafely").
- Clicking `Restore version {n}` calls `useRestoreVersionMutation(noteId).mutate(selectedVersionId)` — no separate confirm step, per the approved spec.
- On restore success: call `onRestored(result)` (parent applies it to the live editor) then call `onClose()` — the drawer closes automatically.
- On any failure (list, preview detail, or restore), render an inline `role="alert"` message and leave prior state intact (no partial/false-success state), consistent with `ShareModal`'s `generateError`/`revokeError` pattern.

**4. `NoteEditorPage.tsx` wiring and the autosave-baseline fix.**

- Add `historyDrawerOpen` state and a `History` button next to the existing `Share` button, both gated on `noteId !== null`.
- Add `handleRestored(result: RestoreVersionResponse)`:
  - `setTitle(result.title)`
  - `setContent(result.content)`
  - `editor?.commands.setContent(result.content, { emitUpdate: false })` (same no-emit pattern already used when loading a note, `NoteEditorPage.tsx:89`)
  - `setPersistedSnapshot({ title: result.title, content: result.content, tagIds })` — **this is the fix for the autosave double-write risk**: it re-baselines `useAutosave`'s dirty-check so the next debounce tick sees no diff and does not fire a redundant `PUT`.
- Render `<VersionHistoryDrawer noteId={noteId} open={historyDrawerOpen} onClose={...} onRestored={handleRestored} />` alongside the existing `<ShareModal>` render, only when `noteId !== null`.

**5. No shared-package changes.**
Confirmed `NoteVersionListItem`, `NoteVersionDetail`, and `RestoreVersionResponse` (`packages/shared/src/notes/schemas.ts:79-102`) already cover every field the drawer needs; they are already exported from `packages/shared/src/index.ts`. Per `packages/shared/CLAUDE.md`, no new/duplicate types are introduced.

## Risks / Trade-offs

- **[Risk]** Restoring while an autosave is mid-flight (already in the 2s debounce window or an in-progress `PUT`) could race with the restore's own note update. → **Mitigation**: none required beyond the existing baseline re-sync (Decision 4) — the restore endpoint's response is the final authority applied after `mutate` resolves, and the following autosave tick will see no diff against the fresh baseline, so at worst one extra in-flight `PUT` from _before_ the restore was clicked completes and is then immediately superseded by the restore in state; this is the same last-write-wins behavior autosave already tolerates.
- **[Risk]** Two concurrent TipTap editor instances (live + drawer preview) increase per-page memory/render cost. → **Mitigation**: the drawer's preview editor is only constructed while `open` is true and only receives content once a version is selected; acceptable given this mirrors the same editor construction cost the app already pays once per note.
- **[Trade-off]** No confirmation dialog before restore (per approved clarification) means a misclick immediately overwrites the live editor's displayed state. → Accepted: restoring is non-destructive to history (old versions remain restorable), and the restore button's label always names the specific version number being restored, satisfying FR-UI-VER-002's "clearly identify the version" requirement without an extra modal step.
