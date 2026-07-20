## 1. Search API Module

- [x] 1.1 Create `frontend/src/features/search/searchApi.ts` with `getSearchResults(params: { q: string; page: number; limit: number })`, calling `apiRequest` against `GET /api/search` and parsing the response through `searchResponseSchema`; include a `buildSearchQueryString` helper (mirroring `buildNotesQueryString` in `notesApi.ts`) encoding `q`/`page`/`limit` into the query string.
- [x] 1.2 Create `frontend/src/features/search/useSearchQuery.ts` wrapping `useQuery` with `queryKey: ["search", { q, page, limit }]`, `enabled: q.trim().length > 0`, and `placeholderData: keepPreviousData`.
- [x] 1.3 Extend `frontend/src/test/mocks/handlers.ts` with a `GET /api/search` handler that filters the existing `NOTES_FIXTURE` by a case-insensitive substring match of `q` against title/body text, returns a synthetic `<mark>`-wrapped `highlight` field per match, and paginates the same way as the existing `/api/notes` handler (needed by every scenario test in section 4).
- [x] 1.4 Add unit tests for the query-string encoding helper from 1.1 (`q`/`page`/`limit` encoding, default `page`/`limit`).
- [x] 1.5 Quality gate: `pnpm --filter frontend build` (must pass with 0 errors/warnings before continuing).

## 2. Presentational Components

- [x] 2.1 Create `frontend/src/features/search/SearchResultItem.tsx` — renders a search result's title as a `Link` to `/notes/:id` (mirroring `NoteListItem`) and the `highlight` snippet rendered via `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.highlight) }}` on a single expression, per the design's Decision 3.
- [x] 2.2 Create `frontend/src/features/search/SearchIdleState.tsx` — presentational idle prompt shown before any keyword has been submitted.
- [x] 2.3 Update `frontend/src/components/NotesListHeader.tsx`: add a "Search" `<Link to="/search">` alongside the existing "New Note" and "Log out" controls.

## 3. Search Page Container and Routing

- [x] 3.1 Create `frontend/src/features/search/SearchPage.tsx`: owns `inputValue`, `submittedQuery`, and `page` local state; the search form's `onSubmit` sets `submittedQuery = inputValue.trim()` and resets `page` to `1`, returning early without changing `submittedQuery` if the trimmed value is empty; calls `useSearchQuery`; composes the keyword input/submit form, and — per the mutually-exclusive branch order from the design's Decision 5 — the idle prompt (`SearchIdleState`), loading feedback, error alert with retry, empty state, or the result list (`SearchResultItem` per result) plus the existing `PaginationControls`.
- [x] 3.2 Update `frontend/src/routes/AppRouter.tsx`: add the `/search` route rendering `<SearchPage />` inside the existing `ProtectedRoute`.
- [x] 3.3 Quality gate: `pnpm --filter frontend build` and `pnpm --filter frontend lint --max-warnings 0` (must both pass before continuing to scenario tests).

## 4. Scenario Test Coverage (`search-ui` spec)

Each task below maps to exactly one named test, per NFR-003/FR-INFRA-005. Tests live in `frontend/src/features/search/SearchPage.test.tsx` unless noted, each rendered with a fresh `QueryClient` (via the existing `createTestQueryClient` helper) wrapped in `MemoryRouter`, per the design's testing approach.

- [x] 4.1 Test "Submitting a search keyword displays matching notes" (Search Keyword Submission and Results Display requirement).
- [x] 4.2 Test "Selecting a search result opens it in the editor" (Search Keyword Submission and Results Display requirement).
- [x] 4.3 Test "Search result contains visually distinguished match information" (Search Result Highlighting requirement) — assert the rendered `<mark>` element is present in the DOM.
- [x] 4.4 Test that a highlight snippet containing a `<script>` tag (constructed directly in the MSW handler response for this one test case) is not present/executed in the rendered DOM after sanitization (Search Result Highlighting requirement — XSS-safety property from design Decision 3/Risk 1).
- [x] 4.5 Test "Navigating search result pages displays the corresponding results" (Search Results Pagination requirement).
- [x] 4.6 Test "Search returns no matching notes" (Search Empty State requirement).
- [x] 4.7 Test "Search page before any submission shows an idle prompt" (Search Idle State requirement) — also assert no `GET /api/search` request is made.
- [x] 4.8 Test "Loading feedback is shown while a search is in flight" (Search Loading and Error Feedback requirement).
- [x] 4.9 Test "Failed search displays error feedback with retry control" (Search Loading and Error Feedback requirement) — assert the full flow of failure → alert shown → click retry → successful refetch → results appear.
- [x] 4.10 Test "Header provides navigation to the search page" (Search Entry Point requirement) — added to `frontend/src/features/notes/NotesListPage.test.tsx` (existing header test location, per the file's established pattern).
- [x] 4.11 Quality gate: `pnpm --filter frontend test` (all tests, including the full existing suite, must pass).

## 5. Final Verification

- [x] 5.1 Manually smoke test the happy path (navigate to `/search` via the header link, submit a keyword, page through multi-page results against the real backend + Postgres, select a result to confirm navigation to the editor) per AGENTS.md §10's manual smoke-test requirement.
- [x] 5.2 Manually smoke test the defined error scenario (simulate a backend/network failure on `GET /api/search`) and confirm the retry control recovers the page.
- [x] 5.3 Confirm new code meets the ≥80% coverage requirement (NFR-003) via the frontend coverage report for `src/features/search/`. Result: 96.42% statements, 92.85% branches, 100% functions, 96.42% lines.
- [x] 5.4 Final quality gate re-run in strict order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` (workspace-wide, not just `frontend/`). All passed: build 0 errors/warnings, lint 0 warnings, tests — shared 86/86, backend 199/199, frontend 60/60, e2e 1/1.
