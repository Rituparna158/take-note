## 1. Editor Data Layer (stores, API, paste sanitization)

- [x] 1.1 Create `frontend/src/stores/editorStore.ts` — Zustand store per design §5: `status: "idle" | "saving" | "saved" | "retrying" | "error"`, `retryCount`, and actions to set each state and reset.
- [x] 1.2 Create `frontend/src/stores/noteStore.ts` — Zustand store per design §9: `openNoteId` only, with a setter and a clear action.
- [x] 1.3 Extend `frontend/src/features/notes/notesApi.ts` with `getNote(id)` (`GET /api/notes/:id`, parsed through `noteResponseSchema`), `createNote(payload)` (`POST /api/notes` with `createNoteRequestSchema`-shaped payload, parsed through `noteResponseSchema`), and `updateNote(id, payload)` (`PUT /api/notes/:id` with `updateNoteRequestSchema`-shaped payload, parsed through `noteResponseSchema`).
- [x] 1.4 Create `frontend/src/features/notes/useNoteQuery.ts` wrapping `useQuery` with `queryKey: ["notes", id]`, mirroring the `useNotesQuery` pattern (design §4).
- [x] 1.5 Create `frontend/src/features/notes/useCreateNoteMutation.ts` and `frontend/src/features/notes/useUpdateNoteMutation.ts` wrapping `useMutation`; both invalidate the `["notes"]` list query key and the `["notes", id]` detail key on success (design §4).
- [x] 1.6 Create `frontend/src/features/notes/pasteSanitizeExtension.ts` — a TipTap `Extension` implementing `transformPastedHTML(html) { return DOMPurify.sanitize(html) }` (design §7).
- [x] 1.7 Extend `frontend/src/test/mocks/handlers.ts` with MSW handlers for `POST /api/notes`, `GET /api/notes/:id`, and `PUT /api/notes/:id` backed by an in-memory fixture (including a 403/404 case for a note the requesting user doesn't own or that doesn't exist), needed by every scenario test in section 6.
- [x] 1.8 Quality gate: `pnpm --filter frontend build` (must pass with 0 errors/warnings before continuing).

## 2. Autosave Hook

- [x] 2.1 Create `frontend/src/features/notes/useAutosave.ts` implementing: a 2-second debounce timer restarted on relevant change; a last-saved-snapshot comparison (`JSON.stringify` of normalized `{title, content, tagIds}`) that skips the `PUT` when nothing changed; a retry loop of up to 3 attempts with 1s/2s/4s backoff on failure; and `EditorStore` status/`retryCount` updates throughout (design §5).
- [x] 2.2 Unit test `useAutosave` with `vi.useFakeTimers()`: debounce fires after 2s of inactivity, an unchanged snapshot performs no request, and a failing save retries with the 1s/2s/4s backoff before surfacing failure.

## 3. Tag Picker Component

- [x] 3.1 Create `frontend/src/features/notes/TagPicker.tsx` — presentational checkbox/chip list rendered from a supplied tag list (from `useTagsQuery()`), with a controlled `selectedTagIds` prop and an `onToggleTag` callback (design §6). No tag-creation control.

## 4. Note Editor Page

- [x] 4.1 Create `frontend/src/features/notes/NoteEditorPage.tsx`: read `useParams()` to branch "new" (no `:id`) vs. "edit" (`:id` present); initialize the TipTap editor (`StarterKit` + the paste-sanitize extension from 1.6) via `useEditor`.
- [x] 4.2 Implement the "new" branch (design §2): on mount, fire `createNote` with `title: "Untitled"` and `content: editor.getJSON()`; on success, store the returned `id` locally and `navigate(`/notes/${id}`, { replace: true })` without remounting the editor.
- [x] 4.3 Implement creation-failure handling (design §2): on `createNote` failure, render a visible error alert with a **Retry** button (re-attempts `createNote`) and a **Back to Notes** button (`navigate("/")`).
- [x] 4.4 Implement the "edit" branch (design §3): call `useNoteQuery(id)`; on success, seed local title/tag-id state from the response and call `editor.commands.setContent(note.content, { emitUpdate: false })`.
- [x] 4.5 Implement fetch-failure handling (design §10): on `useNoteQuery` failure, render a visible error message with a way back to the notes list, matching `NotesListPage`'s existing alert pattern.
- [x] 4.6 Wire `useAutosave` (from 2.1) into the page, keyed off title/content/tag-id changes, armed only once the note's `id` is known (new or edit).
- [x] 4.7 Wire the `TagPicker` (from 3.1) into the page, seeded from the loaded/created note's tags and included in every save payload.
- [x] 4.8 Render a save-state indicator reading `EditorStore`: a "saved" indicator on success, a quiet non-blocking "retrying…" indicator during retries, and a visible error only once retries are exhausted (design §5).
- [x] 4.9 Quality gate: `pnpm --filter frontend build` and `pnpm --filter frontend lint --max-warnings 0` (must both pass before continuing).

## 5. Routing and Entry Points

- [x] 5.1 Update `frontend/src/routes/AppRouter.tsx`: add `/notes/new` and `/notes/:id` routes rendering `NoteEditorPage`, both inside the existing `ProtectedRoute` wrapper (design §1).
- [x] 5.2 Update `frontend/src/components/NotesListHeader.tsx`: add a "New Note" action navigating to `/notes/new` (design §8).
- [x] 5.3 Update `frontend/src/features/notes/NoteListItem.tsx`: make each note navigate to `/notes/${note.id}` on selection, preserving its current visual layout (design §8).
- [x] 5.4 Quality gate: `pnpm --filter frontend build` and `pnpm --filter frontend lint --max-warnings 0` (must both pass before continuing to scenario tests).

## 6. Scenario Test Coverage (`note-editor-ui` spec)

Each task below maps to exactly one named test, per NFR-003/FR-INFRA-005. Tests live in `frontend/src/features/notes/NoteEditorPage.test.tsx` unless noted, each rendered with a fresh `QueryClient` (via the existing `createTestQueryClient` helper) wrapped in `MemoryRouter`, mirroring the AB-1011 testing approach.

- [x] 6.1 Test "Creating a new note opens the rich-text editor" (Note Editor Routes and Content Loading requirement).
- [x] 6.2 Test "Opening an existing note loads its content into the editor" (Note Editor Routes and Content Loading requirement).
- [x] 6.3 Test "New Note action opens the editor for a new note" (Editor Entry Points from the Notes List requirement) — in `NotesListPage.test.tsx`.
- [x] 6.4 Test "Selecting a note in the list opens it in the editor" (Editor Entry Points from the Notes List requirement) — in `NotesListPage.test.tsx`.
- [x] 6.5 Test "Changed rich-text content can be saved" (Rich-Text Content Changes and Tag Assignment requirement).
- [x] 6.6 Test "Assigning an accessible tag associates it with the note" (Rich-Text Content Changes and Tag Assignment requirement).
- [x] 6.7 Test "Pasted HTML content is sanitized before insertion" (Pasted Content Sanitization requirement). Implemented in a dedicated `pasteSanitizeExtension.test.ts`, calling `transformPastedHTML` directly rather than through a simulated DOM paste event — StarterKit's `CodeBlock` extension has an unrelated paste-handler incompatibility with jsdom that a full end-to-end paste event would hit.
- [x] 6.8 Test "Changed content is automatically saved after inactivity" (Note Autosave Trigger requirement). Implemented with real timers + `waitFor` rather than fake timers — `vi.useFakeTimers()` didn't reliably resolve the real `fetch`/MSW/TanStack-Query promise chain in this environment (the debounce/retry mechanism itself is already precisely covered with fake timers in `useAutosave.test.ts`, which mocks `onSave` directly).
- [x] 6.9 Test "Unnecessary autosave is not performed" (Note Autosave Trigger requirement). Real timers, per above.
- [x] 6.10 Test "Successful autosave is identifiable to the user" (Autosave Save-State Feedback requirement). Real timers, per above.
- [x] 6.11 Test "Autosave retries before notifying the user of failure" (Autosave Retry and Failure Feedback requirement). Real timers, per above.
- [x] 6.12 Test "Autosave failure is shown after retries are exhausted" (Autosave Retry and Failure Feedback requirement). Real timers, per above. Writing 6.8–6.12 surfaced and fixed two real bugs: `useAutosave`'s effect depended on the `value` object's reference (recreated every render, including renders triggered by the hook's own status updates), causing it to restart the debounce every ~2s indefinitely instead of running its 1s/2s/4s backoff loop — fixed by keying the effect on a stringified snapshot instead. Separately, for existing notes autosave was arming before the fetched note data loaded, so the placeholder→real-data transition was misread as a user edit — fixed by gating `enabled` on `appliedNoteId === noteId` (or `createdLocally` for new notes).
- [x] 6.13 Quality gate: `pnpm --filter frontend test` (all tests, including the full existing suite, must pass). 41/41 passed.

## 7. Final Verification

- [x] 7.1 Manually smoke test the happy path (AGENTS.md §10) against the real backend/Postgres. Driven via a temporary Playwright script (real Chromium, deleted after use) against the running dev server (`localhost:5173`) and backend (`localhost:3000`): registered a user → landed on notes list → "New Note" → edited title and rich-text content → assigned a tag (created via API, since tag-creation UI is out of scope) → autosave succeeded ("Saved" indicator) → **real page refresh** → title, content, and tag all persisted, confirming the round-trip through the actual backend/Postgres. Test user/note/tag left in the local dev database (disposable, not a shared/production system).
- [x] 7.2 Manually smoke test the defined error scenarios, same session/script: intercepted `PUT /api/notes/:id` to always fail → "Retrying save…" indicator appeared → visible failure message appeared once all retries were exhausted; intercepted `POST /api/notes` to fail → creation-failure alert appeared → **Retry** recovered and reached the editor; navigated to a nonexistent note ID → fetch-failure alert appeared (confirmed the app's default `QueryClient` retries queries 3× before settling into the error state — pre-existing AB-1001 infrastructure, not specific to this ticket).
- [x] 7.3 Confirm new code meets the ≥80% coverage requirement (NFR-003) via the frontend coverage report. `src/features/notes/` (this ticket's primary new code): 96.89% statements, 90.38% branches, 97.26% functions, 97.77% lines. `NoteEditorPage.tsx` individually: 97.18/94.44/95.65/98.43. `stores/editorStore.ts` and `stores/noteStore.ts`: 100% across all metrics (confirmed after wiring `NoteStore` into the page and adding creation/fetch-failure retry tests, which also closed a coverage gap found during this check). All comfortably above the 80% threshold.
- [x] 7.4 Final quality gate re-run in strict order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` (workspace-wide, not just `frontend/`). Re-run again after the post-review fixes below: all passed — build 0 errors/warnings across shared/backend/frontend; lint 0 warnings across all three; tests — shared 86/86, frontend 47/47, backend 199/199, e2e 1/1.

### Post-review remediation

A fresh-session `/review` found two issues, both now fixed and re-verified:

1. **Specification drift (high, confirmed)**: `fireCreateNote`'s `onSuccess` called `setContent(initialContent)`, resetting the `content` state back to the pre-request empty snapshot — discarding any text typed during the `POST /api/notes` round-trip while still showing "Saved". Fixed by removing that call (the editor's `onUpdate` callback already keeps `content` correctly in sync).
2. **Weak test assertion (medium, confirmed)**: "Creating a new note opens the rich-text editor" never asserted `POST /api/notes` was actually called — it would have passed even if creation silently never fired. Strengthened with a `capturePostRequests()` helper asserting the call and its payload.

Fixing finding 1 surfaced a deeper latent bug during regression testing: even after removing `setContent(initialContent)`, `useAutosave`'s baseline was still established from whatever `content` happened to be the moment autosave armed — not from what was actually sent in the `POST`. Content typed during the in-flight request would be silently treated as "already saved" and never actually persisted (no visible symptom, since the editor's own DOM view is unaffected — the loss was purely in what would eventually reach the server). Fixed by adding a required `initialSnapshot` parameter to `useAutosave` so the caller supplies the value truly known to be persisted (the `POST`/`GET` payload) rather than letting the hook infer a baseline from current state; `NoteEditorPage` now tracks this via a `persistedSnapshot` state set alongside `createdLocally`/the edit-load sync. A new regression test ("Content typed during note creation is not discarded") was verified to fail against the pre-fix behavior and pass against the fix, plus a new `useAutosave` unit test covers the same drift-seeding contract directly.

A second, independent fresh-session `/review` found one further issue, now fixed and re-verified: 3. **Robustness gap (plausible, confirmed by test)**: the new-note creation effect gated `fireCreateNote()` on React state (`noteId !== null`) only. Under `<StrictMode>` (enabled in `main.tsx`), React double-invokes mount effects synchronously in development, before the first mutation's `onSuccess` can set `noteId` — so both invocations could see `noteId === null` and both fire a real `POST /api/notes`, silently creating two "Untitled" notes per visit to `/notes/new` in dev (not in production builds, which don't double-invoke). Fixed by adding a `useRef` sentinel (`hasFiredCreateRef`) checked and set synchronously inside the effect, so only the first invocation ever calls `fireCreateNote()`; the manual **Retry** button is unaffected since it calls `fireCreateNote()` directly, not through the gated effect. A new test ("Only one note is created under React StrictMode's double-invoked mount effects", rendering via a `<StrictMode>`-wrapped `renderEditorStrict` helper) was verified to fail against the pre-fix behavior (2 POSTs) and pass against the fix (1 POST).

Final quality gate re-run after this fix: all passed — build 0 errors/warnings across shared/backend/frontend; lint 0 warnings across all three; tests — shared 86/86, frontend 48/48, backend 199/199, e2e 1/1.
