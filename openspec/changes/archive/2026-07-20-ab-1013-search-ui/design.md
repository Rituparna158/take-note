## Context

`GET /api/search` is fully implemented on the backend (AB-1007) with `packages/shared` schemas already defined (`searchQuerySchema`, `searchResponseSchema`, `noteSearchResultSchema` — the latter extends `noteResponseSchema` with a `highlight: string` field containing `<mark>`-wrapped HTML from PostgreSQL's `ts_headline`). No frontend interface consumes it yet. The notes-list (AB-1011) and note-editor (AB-1012) tickets already established the frontend conventions this ticket follows: `QueryClientProvider` is wired up app-wide, `apiRequest`/feature-colocated API modules exist for notes/tags, `PaginationControls` is a reusable presentational component, and `DOMPurify` (`3.4.12`, already a pinned dependency) is already used once in the codebase (`pasteSanitizeExtension.ts`) to sanitize pasted editor HTML — this ticket is its second use, this time for rendering trusted-but-HTML-bearing server data.

## Goals / Non-Goals

**Goals:**

- Add a `/search` route (inside `ProtectedRoute`) implementing all `search-ui/spec.md` requirements: keyword submission, results display with sanitized highlight rendering, pagination, idle/loading/empty/error states, result-to-editor navigation, and a header entry point.
- Reuse existing infrastructure as-is: `apiRequest`, `PaginationControls`, `packages/shared` search schemas, and the `QueryClientProvider`/TanStack Query pattern from `useNotesQuery`.
- Follow the same page-local-state and feature-colocated-module conventions established in AB-1011/AB-1012.

**Non-Goals:**

- Any backend or `packages/shared` change — `GET /api/search` and its schemas are consumed exactly as they exist today.
- Live/debounced-as-you-type search — submission is explicit only, per the approved proposal.
- Filtering or sorting search results — the search endpoint does not support these; only `q`, `page`, `limit` are accepted.
- Any change to the notes list page's own search/filter behavior — tag filtering there is unrelated and untouched.

## Decisions

### 1. Feature module: `frontend/src/features/search/`

New files, mirroring the `features/notes/` pattern:

- `searchApi.ts` — `getSearchResults(params: { q: string; page: number; limit: number })`, calling `apiRequest<unknown>({ method: "GET", path: `/api/search?${query}` })` and parsing the response through `searchResponseSchema`. A `buildSearchQueryString` helper mirrors `buildNotesQueryString` in `notesApi.ts`.
- `useSearchQuery.ts` — wraps `useQuery` with `queryKey: ["search", { q, page, limit }]`, `enabled: q.trim().length > 0` (so no request fires until a keyword has been submitted — this is what implements the Idle State requirement without a separate boolean flag), and `placeholderData: keepPreviousData` (consistent with `useNotesQuery`, so paging within the same keyword doesn't flash empty).
- `SearchPage.tsx` — container/page component, registered at `/search`.
- `SearchResultItem.tsx` — presentational: renders title (via `Link` to `/notes/:id`, mirroring `NoteListItem`) and the sanitized highlight snippet.
- `SearchIdleState.tsx` / reuse pattern — a small presentational prompt shown when no keyword has been submitted yet.

### 2. Submitted-keyword as the query-enabling state

`SearchPage` holds `inputValue` (the live text field) and `submittedQuery` (the last submitted keyword) as separate `useState` values, plus `page`. Only `submittedQuery` feeds `useSearchQuery`; `inputValue` never triggers a fetch on its own. Submitting the form (via `onSubmit`, so both Enter and a Search button work through native form semantics) sets `submittedQuery = inputValue.trim()` and resets `page` to `1`.

- **Alternative considered**: A single `query` state used directly as both the controlled input value and the fetch key, triggering `useQuery` on every keystroke. Rejected — this is exactly the live/debounced behavior the proposal explicitly excludes; keeping `inputValue`/`submittedQuery` separate is what makes "explicit submit only" structurally true rather than incidentally true.
- **Empty/whitespace submit**: If `inputValue.trim()` is empty, the form submit handler returns early without changing `submittedQuery` — this keeps the shared `searchQuerySchema`'s `min(1)` constraint satisfied without needing a separate client-side validation message (an empty submit simply does nothing, leaving whatever state — idle or previous results — already on screen).

### 3. Highlight rendering via sanitize-then-`dangerouslySetInnerHTML`

`SearchResultItem` renders the snippet as:

```tsx
<p
  className="mt-2 text-sm text-slate-600"
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.highlight) }}
/>
```

This is the one narrow, explicit exception to `frontend/CLAUDE.md`'s "never use `dangerouslySetInnerHTML` on unsanitized content" rule — the content **is** sanitized immediately before use, and this is the documented mechanism for rendering `ts_headline` output (SDS §4.2: "The frontend safely renders the search snippet in the UI interface (using DOMPurify to sanitize HTML content)"). `DOMPurify.sanitize` is called with its default config (matching the one existing call site in `pasteSanitizeExtension.ts`), which strips everything except a safe allowlist — `<mark>` is part of that default allowlist, so highlight markup survives while any injected `<script>`/event-handler content does not.

- **Alternative considered**: Parse the `<mark>...</mark>` snippet into plain segments client-side and render them as React elements (no `dangerouslySetInnerHTML` at all). Rejected — `ts_headline`'s output isn't guaranteed to only ever contain a single well-formed `<mark>` pair with no other markup (it may combine multiple match fragments with truncation ellipses), so a hand-rolled parser would be reimplementing what DOMPurify already does correctly, adding risk without benefit.

### 4. Pagination via the existing `PaginationControls`

`SearchPage` passes `searchQuery.data.meta` straight into the existing `PaginationControls` component (no forking/duplication), with `onPageChange` updating local `page` state — identical wiring to `NotesListPage`.

### 5. State rendering priority

Mutually exclusive branches, checked in this order:

1. `submittedQuery === ""` → idle prompt (no request has been made; `useSearchQuery` is `enabled: false` so there's no `isLoading` to race against).
2. `searchQuery.isLoading` → loading feedback.
3. `searchQuery.isError` → error alert + retry button (`onClick={() => void searchQuery.refetch()}`).
4. `searchQuery.data.data.length === 0` → empty state ("No notes match your search.").
5. Otherwise → result list + `PaginationControls`.

This mirrors the exact precedence pattern already used in `NotesListPage` (loading / error / content branches), for consistency and to keep the implementation reviewable against a familiar shape.

### 6. Header entry point

`NotesListHeader.tsx` gains a "Search" `<Link to="/search">` (react-router, not a `navigate()` button-click, since it's pure navigation with no side effect to run first — unlike logout) placed alongside the existing "New Note" and "Log out" controls.

### 7. Routing

`AppRouter.tsx` adds:

```tsx
<Route
  path="/search"
  element={
    <ProtectedRoute>
      <SearchPage />
    </ProtectedRoute>
  }
/>
```

### 8. Testing approach

- Extend `frontend/src/test/mocks/handlers.ts` with a `GET /api/search` handler that filters the existing `NOTES_FIXTURE` by a case-insensitive title/body-text substring match against `q`, returning a synthetic `<mark>`-wrapped `highlight` field, paginated the same way as the `/api/notes` handler. This is enough to drive every `search-ui` scenario (matches, no-matches, multi-page) without needing real PostgreSQL FTS semantics in a component test.
- `SearchPage.test.tsx` covers all nine scenarios in `search-ui/spec.md` (idle prompt, submit → results, result → navigates to editor, highlight rendering/sanitization, pagination, empty state, loading feedback, error + retry, and — in `NotesListHeader.test.tsx` — the header nav link), each as one uniquely named test per NFR-003/FR-INFRA-005.
- A dedicated test asserts that a highlight snippet containing a `<script>` tag (constructed directly in the MSW handler response for that one test case, not via real search) is not present in the rendered DOM after sanitization, directly exercising the XSS-safety property described in Decision 3.
- Follows the existing MSW + RTL + `userEvent` pattern from `frontend/src/features/notes/NotesListPage.test.tsx`, with a fresh per-test `QueryClient` (`retry: false`, `staleTime: 0`).

## Risks / Trade-offs

- **[Risk]** `dangerouslySetInnerHTML` is inherently sensitive; a future change to this component could accidentally remove the `DOMPurify.sanitize` call and silently reintroduce an XSS hole. **Mitigation**: the sanitize call and the `dangerouslySetInnerHTML` prop are written on the same expression (`dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(...) }}`) rather than as a separately-computed variable, so there's no path where the raw string can be substituted without an obvious visual diff; the dedicated sanitization test in Decision 8 also guards this regression.
- **[Risk]** `enabled: q.trim().length > 0` means switching the query key's `q` to `""` (e.g., a "clear" affordance) after a successful search would leave stale results/error state cached under the old key while showing the idle branch, if a clear action is added carelessly. **Mitigation**: not in scope for this ticket (no clear affordance was requested/approved); the state-priority order in Decision 5 already treats `submittedQuery === ""` as an unconditional idle branch regardless of any lingering cached query data, so this fails safe today, and any future ticket adding a "clear" control should reset via the same `submittedQuery` state, not touch cache directly.
- **[Risk]** The MSW fixture's substring-match search is not a faithful stand-in for PostgreSQL's `plainto_tsquery`/`ts_headline` behavior (e.g., no stemming). **Mitigation**: acceptable — component tests target frontend behavior (rendering, pagination, sanitization, navigation), not search-relevance correctness, which is already covered by `note-search`'s existing backend integration tests.

## Migration Plan

Pure frontend change; no database migration, no backend deployment, no feature flag. Ships as a normal frontend build once merged. Rollback is a plain revert of the commit(s) — no data or schema changes to unwind.

## Open Questions

None blocking. Exact Tailwind visual styling of the new components follows the visual conventions already established by `NotesListPage`/`NoteListItem` for consistency.
