## 1. Query Infrastructure

- [x] 1.1 Create `frontend/src/lib/queryClient.ts` exporting a singleton `QueryClient` instance.
- [x] 1.2 Wire `QueryClientProvider` (using the client from 1.1) around `<App />` in `frontend/src/main.tsx`.
- [x] 1.3 Create `frontend/src/test/createTestQueryClient.ts` exporting a utility helper that returns a fresh `QueryClient` with `retry: false` and `staleTime: 0` configured for component test environments.
- [x] 1.4 Quality gate: `pnpm --filter frontend build` (must pass with 0 errors/warnings before continuing).

## 2. Notes and Tags API Modules

- [x] 2.1 Create `frontend/src/features/notes/notesApi.ts` with `getNotes(params)`, calling `apiRequest` against `GET /api/notes` and parsing the response through `noteListResponseSchema`; include the single shared helper that encodes `sortBy`/`sortOrder`/`page`/`limit`/`tags` (comma-separated, matching `listNotesQuerySchema`) into the query string.
- [x] 2.2 Create `frontend/src/features/tags/tagsApi.ts` with `getTags()`, calling `apiRequest` against `GET /api/tags` and parsing the response through `tagListResponseSchema`.
- [x] 2.3 Create `frontend/src/features/notes/useNotesQuery.ts` wrapping `useQuery` with `queryKey: ["notes", { page, limit, sortBy, sortOrder, tags: [...tags].sort() }]` and `placeholderData: keepPreviousData`.
- [x] 2.4 Create `frontend/src/features/tags/useTagsQuery.ts` wrapping `useQuery` with `queryKey: ["tags"]`.
- [x] 2.5 Extend `frontend/src/test/mocks/handlers.ts` with `GET /api/notes` and `GET /api/tags` MSW handlers backed by an in-memory fixture list, honoring `page`/`limit`/`sortBy`/`sortOrder`/`tags` query params (needed by every scenario test in section 5).
- [x] 2.6 Add unit tests for the query-string encoding helper from 2.1 (normalization/comma-joining of `tags`, default `page`/`limit`/`sortBy`/`sortOrder`).

## 3. Presentational Components

- [x] 3.1 Create `frontend/src/components/NotesListHeader.tsx` — signed-in email + logout control, reusing `logout()` from `frontend/src/features/auth/authApi.ts` inside the try/finally pattern from the design (unconditionally clears `AuthStore` and navigates to `/login` even if the API call fails).
- [x] 3.2 Create `frontend/src/features/notes/SortControls.tsx` — `sortBy`/`sortOrder` selector controls, presentational (props in, callbacks out).
- [x] 3.3 Create `frontend/src/features/notes/TagFilterControls.tsx` — multi-select tag chips/checkboxes rendered from a supplied tag list, presentational.
- [x] 3.4 Create `frontend/src/features/notes/NoteListItem.tsx` — renders one note's title, tags, and timestamps; not a link or button (no click-through, per the design's Non-Goals).
- [x] 3.5 Create `frontend/src/features/notes/PaginationControls.tsx` — page navigation controls driven by a supplied `meta` object (`page`, `limit`, `totalCount`, `totalPages`).
- [x] 3.6 Create `frontend/src/features/notes/EmptyState.tsx` — accepts a flag for "filtered vs. no notes at all" and renders the corresponding message.

## 4. Notes List Page Container

- [x] 4.1 Create `frontend/src/features/notes/NotesListPage.tsx`: owns `page`/`sortBy`/`sortOrder`/`selectedTagIds` local state; resets `page` to `1` whenever tags, `sortBy`, or `sortOrder` change; calls `useNotesQuery`/`useTagsQuery`; composes `NotesListHeader`, `SortControls`, `TagFilterControls`, the notes list (`NoteListItem` per note or `EmptyState` when `data.length === 0`), and `PaginationControls`.
- [x] 4.2 Implement the mutually-exclusive state branches in `NotesListPage`: full-page loading state (`isLoading`), inline "Updating…" indicator (`isFetching && !isLoading`), error alert with a "Retry" button (calls `refetch()`) on query failure, and the empty/list branches — per the design's State Priority & Error Handling decision.
- [x] 4.3 Update `frontend/src/routes/AppRouter.tsx`: replace `<AuthenticatedPlaceholderPage />` with `<NotesListPage />` on the `/` route inside the existing `ProtectedRoute`.
- [x] 4.4 Delete `frontend/src/features/auth/AuthenticatedPlaceholderPage.tsx` and `frontend/src/features/auth/AuthenticatedPlaceholderPage.test.tsx`. (Also updated `App.test.tsx`, a direct consequence of the route swap: wrapped with `QueryClientProvider` and reasserted against `NotesListPage` content instead of the deleted placeholder's text.)
- [x] 4.5 Quality gate: `pnpm --filter frontend build` and `pnpm --filter frontend lint --max-warnings 0` (must both pass before continuing to scenario tests).

## 5. Scenario Test Coverage (`notes-list-ui` spec)

Each task below maps to exactly one named test, per NFR-003/FR-INFRA-005. Tests live in `frontend/src/features/notes/NotesListPage.test.tsx` unless noted, each rendered with a fresh `QueryClient` created using the helper from 1.3, wrapped in `MemoryRouter`, per the design's testing approach.

- [x] 5.1 Test "Authenticated user views their active notes" (Notes List Page requirement).
- [x] 5.2 Test "Loading feedback is shown while notes are being fetched" (Notes List Page requirement).
- [x] 5.3 Test "Changing page displays the corresponding notes" (Notes Pagination Controls requirement).
- [x] 5.4 Test "Changing sort updates the displayed note order" (Notes Sorting Controls requirement).
- [x] 5.5 Test "Applying a single tag filter displays matching notes" (Tag Filter Controls requirement).
- [x] 5.6 Test "Applying multiple tag filters displays only notes matching all selected tags" (Tag Filter Controls requirement).
- [x] 5.7 Test "No notes exist for the user" (Empty State Feedback requirement).
- [x] 5.8 Test "No notes match the current tag filter" (Empty State Feedback requirement).
- [x] 5.9 Test "Header displays the signed-in user's email" (Authenticated Header and Logout requirement).
- [x] 5.10 Test "Logout ends the session and returns to login" (Authenticated Header and Logout requirement) — explicitly verify that the API logout is called, `AuthStore` is cleared, and navigation to `/login` occurs.
- [x] 5.11 Test the error-alert-and-retry branch (design §5 "Error & Retry Handling") — assert the full flow of failure → alert shown → click retry → successful refetch → alert disappears → notes appear.
- [x] 5.12 Quality gate: `pnpm --filter frontend test` (all tests, including the full existing suite, must pass).

## 6. Final Verification

- [x] 6.1 Manually smoke test the happy path (navigate to `/`, page/sort/filter through real backend + Postgres, logout) per AGENTS.md §10's manual smoke-test requirement. Verified via headless Chromium against the real backend/Postgres with 12 seeded notes and 2 tags: login → notes list renders, pagination (10/2 split across pages), sort control interaction, single- and multi-tag filtering (AND semantics), header email display, and logout all confirmed with 0 console errors. Seeded test data cleaned up afterward.
- [x] 6.2 Manually smoke test the defined error scenario (simulate a backend/network failure) and confirm the retry control recovers the page. Verified by intercepting `GET /api/notes` to fail the initial request plus all automatic retries; the error alert with "Retry" rendered, and clicking it recovered the notes list.
- [x] 6.3 Confirm new code meets the ≥80% coverage requirement (NFR-003) via the frontend coverage report. `src/features/notes/` (this ticket's new code): 96.07% statements, 88.23% branches, 95.83% functions, 98% lines — all above 80%.
- [x] 6.4 Final quality gate re-run in strict order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` (workspace-wide, not just `frontend/`). All passed: build 0 errors/warnings, lint 0 warnings, tests — shared 86/86, frontend 26/26, backend 199/199, e2e 1/1.
