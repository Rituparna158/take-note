## 1. Frontend API Layer

- [x] 1.1 Create `frontend/src/features/notes/versionsApi.ts` with `getNoteVersions(noteId)`, `getNoteVersion(noteId, versionId)`, and `restoreNoteVersion(noteId, versionId)`, each calling `apiRequest` and parsing the response with the existing `@take-note/shared` schemas (`noteVersionListItemSchema` as an array, `noteVersionDetailSchema`, `restoreVersionResponseSchema`) — design.md Decision 1.
- [x] 1.2 Add `frontend/src/features/notes/versionsApi.test.ts` unit tests (mirroring `notesApi.test.ts`) verifying each function calls the correct method/path and parses a well-formed response.

## 2. TanStack Query Hooks

- [x] 2.1 Create `frontend/src/features/notes/useNoteVersionsQuery.ts` — `useQuery`, `queryKey: ["notes", noteId, "versions"]`, `enabled` only while the drawer is open — design.md Decision 2.
- [x] 2.2 Create `frontend/src/features/notes/useNoteVersionQuery.ts` — `useQuery`, `queryKey: ["notes", noteId, "versions", versionId]`, `enabled` only once a version is selected — design.md Decision 2.
- [x] 2.3 Create `frontend/src/features/notes/useRestoreVersionMutation.ts` — `useMutation` calling `restoreNoteVersion`; `onSuccess` invalidates `["notes", noteId]`, `["notes"]`, and `["notes", noteId, "versions"]` — design.md Decision 2.

## 3. Version History Drawer Component

- [x] 3.1 Create `frontend/src/features/notes/VersionHistoryDrawer.tsx` shell: `{ noteId, open, onClose, onRestored }` props, `role="dialog" aria-modal="true" aria-label="Version history"`, right-side drawer layout — design.md Decision 3.
- [x] 3.2 Implement the version list using `useNoteVersionsQuery`: each item shows `Version {n} — {savedAt}` and sets `selectedVersionId` on click (FR-UI-VER-001: "historical versions exist" / "user selects a version").
- [x] 3.3 Implement the read-only preview for `selectedVersionId` using `useNoteVersionQuery` and a second `useEditor` instance (`editable: false`, same `extensions: [StarterKit, PasteSanitizeExtension]` as the live editor) that calls `setContent` when the fetched version changes — design.md Decision 3 (FR-UI-VER-001: "user previews a version").
- [x] 3.4 Implement the `Restore version {n}` action wired to `useRestoreVersionMutation`, an inline `role="alert"` error message for list/preview/restore failures, and on restore success call `onRestored(result)` then `onClose()` (FR-UI-VER-002: all scenarios).

## 4. Note Editor Integration

- [x] 4.1 Add `historyDrawerOpen` state and a `History` button to `frontend/src/features/notes/NoteEditorPage.tsx`, positioned next to the existing `Share` button, gated on `noteId !== null` — design.md Decision 4.
- [x] 4.2 Implement `handleRestored(result: RestoreVersionResponse)` in `NoteEditorPage.tsx`: `setTitle`, `setContent`, `editor?.commands.setContent(result.content, { emitUpdate: false })`, and **re-baseline `persistedSnapshot`** to the restored `{ title, content, tagIds }` so autosave does not fire a redundant `PUT` afterward — design.md Decision 4 / Risks section (this is the autosave double-write fix). **Note:** implementation deviated from design.md here — re-baselining `persistedSnapshot` alone proved insufficient because `useAutosave`'s internal dirty-check ref only seeds from that prop on first activation, not on every change. Fixed by adding a `markSaved(value)` imperative escape hatch to `useAutosave.ts` (new file touched, outside the original design's file list) and calling it from `handleRestored`. See conversation for the discovered blocker and approved fix.
- [x] 4.3 Render `<VersionHistoryDrawer noteId={noteId} open={historyDrawerOpen} onClose={...} onRestored={handleRestored} />` alongside the existing `<ShareModal>`, only when `noteId !== null`.

## 5. Test Fixtures

- [x] 5.1 Add MSW handlers to `frontend/src/test/mocks/handlers.ts` for `GET /api/notes/:id/versions` (list), `GET /api/notes/:id/versions/:versionId` (detail), and `POST /api/notes/:id/versions/:versionId/restore`, including both success fixtures and at least one failure-path handler, following the existing fixed-UUID/`EDITABLE_NOTE_ID` conventions.

## 6. Component Tests (FRS Scenario Coverage)

- [x] 6.1 `VersionHistoryDrawer.test.tsx` — "Note owner opens version history": drawer is displayed when `open`.
- [x] 6.2 `VersionHistoryDrawer.test.tsx` — "Historical versions exist": listed versions show version number and saved date.
- [x] 6.3 `VersionHistoryDrawer.test.tsx` — "User selects a version": selecting an item displays that version's historical title/content read-only.
- [x] 6.4 `VersionHistoryDrawer.test.tsx` — "User previews a version": previewing does not call `onRestored` or otherwise mutate the live note state.
- [x] 6.5 `VersionHistoryDrawer.test.tsx` — "User selects an available version for restoration": a restore action naming that version's number becomes available.
- [x] 6.6 `VersionHistoryDrawer.test.tsx` — "Restore succeeds": `onRestored` is called with the restored title/content and the drawer closes.
- [x] 6.7 `VersionHistoryDrawer.test.tsx` — "Restore fails": visible error feedback is shown and `onRestored`/`onClose` are not called.
- [x] 6.8 `NoteEditorPage.test.tsx` additions: the `History` button opens the drawer only once a note exists; a successful restore updates the displayed title/content in the editor and does not trigger a follow-up autosave `PUT` (regression test for the design's autosave-baseline fix). Also added a direct `useAutosave.test.ts` unit test for the new `markSaved` API.

## 7. Quality Gates & Manual Smoke Test

- [x] 7.1 Run `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` in that exact order (AGENTS.md §4.3); do not proceed past a failing checkpoint. All three passed cleanly (build: 0 errors/warnings; lint: 0 warnings; test: shared+backend 199/199+frontend 85/85+e2e 1/1, all green).
- [x] 7.2 Confirm new code meets the 80% coverage bar (AGENTS.md §10) and that every FRS §14 scenario maps to exactly one uniquely named test (NFR-006). Coverage: 91.4% stmts / 82.2% branches overall; new files individually 96%+ or 100%. All 7 FRS §14 scenarios map 1:1 to a uniquely named test in `VersionHistoryDrawer.test.tsx`.
- [x] 7.3 Manually smoke test the happy path and the defined error scenario in the running app, per AGENTS.md §10. **Note:** a live-browser smoke test via a throwaway Playwright script was attempted against the real dev stack but was not completed — the user directed skipping it and relying on the automated test suite (`pnpm test`) instead, which was re-run clean as the basis for this checkpoint. No interactive browser verification was performed this session.

---

**Subagent delegation**: no individual task above is estimated to exceed 45 minutes; none are flagged for delegation.

**Git worktrees**: not applicable — this ticket is frontend-only with a strictly sequential dependency chain (API layer → hooks → drawer component → page integration → tests), so there is no independent parallel work to isolate in a separate worktree.
