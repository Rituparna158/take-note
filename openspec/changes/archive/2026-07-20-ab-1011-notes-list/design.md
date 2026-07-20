## Context

`AuthenticatedPlaceholderPage` (AB-1010) is the current authenticated landing route at `/`, wrapped by the existing `ProtectedRoute`. It shows only the signed-in user's email and a logout button. `GET /api/notes` (paginated, sortable, tag-filterable per FR-NOTE-006/007/008) and `GET /api/tags` (per FR-TAG-002) are fully implemented on the backend with schemas already defined in `packages/shared` (`listNotesQuerySchema`, `noteListResponseSchema`, `tagListResponseSchema`). `@tanstack/react-query` (`5.101.2`) is already a pinned frontend dependency but has never been wired up — no `QueryClientProvider` exists yet in `main.tsx`/`App.tsx`, and AB-1010's auth pages use plain `apiRequest` calls with local component state instead. This ticket is the first to introduce TanStack Query as actual server-state infrastructure, per the SDS §11.1 architecture.

## Goals / Non-Goals

**Goals:**

- Replace `AuthenticatedPlaceholderPage` with a notes list page at the protected `/` route, per the approved proposal.
- Wire up `QueryClientProvider` for the whole app (first real consumer of TanStack Query), consistent with SDS §11.1's server-state architecture.
- Implement all six FR-UI-NOTES-001 acceptance scenarios plus the two additional scenarios approved during `/spec` (empty state, header/logout carryover), exactly as written in `notes-list-ui/spec.md`.
- Keep note-list UI state (current page, sort, selected tag filters) as page-local React state — not a new Zustand store — since AGENTS.md/SDS §11.2 authorize exactly three Zustand stores (`AuthStore`, `NoteStore`, `EditorStore`) and this state doesn't fit any of their documented purposes.

**Non-Goals:**

- Note creation, editing, or click-through navigation to a note detail/editor view (AB-1012).
- Search (AB-1013), sharing (AB-1014), or version history (AB-1015) UI.
- Any backend, Prisma schema, or `packages/shared` schema change — all consumed schemas already exist and are used as-is.
- Introducing a new Zustand store for notes-list filter/sort/page state.

## Decisions

### 1. Introduce app-wide `QueryClientProvider` now

A single `QueryClient` instance is created in a new `frontend/src/lib/queryClient.ts` and provided via `QueryClientProvider` wrapping `<App />` in `main.tsx`. This is the natural point to introduce it since it must wrap the router so any future route can use `useQuery`/`useMutation`.

- **Alternative considered**: Defer provider setup to AB-1012. Rejected — this ticket is the first to need query-backed data, and SDS §11.1 already designates TanStack Query as the server-state layer; deferring would leave the two notes-list queries as ad hoc `useEffect`+`fetch` calls that would just need replacing next ticket.

### 2. Feature-colocated API + query-hook modules

Add `frontend/src/features/notes/notesApi.ts` (`getNotes(params)`, parsing the response through `noteListResponseSchema`) and `frontend/src/features/tags/tagsApi.ts` (`getTags()`, parsing through `tagListResponseSchema`), mirroring the existing `authApi.ts` pattern (plain async functions calling `apiRequest`, parsed with the shared Zod schema). Query hooks (`useNotesQuery`, `useTagsQuery`) live alongside them in the same feature folders and wrap `useQuery` with:

- `queryKey: ["notes", { page, limit, sortBy, sortOrder, tags: [...tags].sort() }]` / `["tags"]` (normalizing the tags array so that tag selections like `[a, b]` and `[b, a]` hit the same cached query key).
- `placeholderData: keepPreviousData` (TanStack Query v5) for the notes query, so changing page/sort/filter keeps the previous list visible instead of unmounting it during refetch.

### 3. Page-local state for pagination/sort/tag-filter selection

`NotesListPage` owns `page`, `sortBy`, `sortOrder`, and `selectedTagIds` as local `useState` and passes them down to `useNotesQuery` and to the presentational controls. This is plain page-local UI state, not shared across routes or components outside this page, so it does not warrant a new global Zustand store per the architecture constraint in AGENTS.md/SDS §11.2.

- **Pagination Reset on Filter/Sort Change**: Whenever the selected tags, sort field, or sort direction change, the `page` state is reset to `1` to avoid getting stranded on a page number that has no results under the new parameters.
- **Alternative considered**: Add the filter/sort/page state to `NoteStore`. Rejected — `NoteStore`'s documented purpose (SDS §11.2) is "the ID of the note currently open in the editor, and unsaved draft state," which is unrelated to list-browsing UI state; overloading it would blur its responsibility.

### 4. Component decomposition

`NotesListPage` (container, in `frontend/src/features/notes/`) composes:

- `NotesListHeader` (extracted as a reusable component in `frontend/src/components/NotesListHeader.tsx`) — signed-in email + logout button. Logout is executed in a resilient try-finally block:
  ```typescript
  try {
    await authApi.logout();
  } finally {
    authStore.clearSession(); // unconditionally clear state
    navigate("/login");
  }
  ```
- `SortControls` — `sortBy`/`sortOrder` selectors.
- `TagFilterControls` — multi-select list of tag chips/checkboxes sourced from `useTagsQuery()` (all tags, unfiltered by count, per the approved proposal).
- `NoteListItem` — renders one note's title, tags, and timestamps; not a link/button (no click-through, per Non-Goals).
- `PaginationControls` — page navigation driven by the `meta` object.
- `EmptyState` — rendered instead of the list when `data.length === 0`; message varies based on whether `selectedTagIds.length > 0` (matches vs. filter) to satisfy both empty-state scenarios in the spec.
  All data-fetching and param-building logic stays in the page container and hooks; the child components are presentational, per `frontend/CLAUDE.md`'s "business logic belongs in hooks or service layers" rule.

### 5. State Priority & Error Handling

- **State Mutex**: Initial loading (`useNotesQuery().isLoading`), empty state (`data.length === 0`), and error state (when notes or tags fetch fails) are rendered as mutually exclusive UI branches to avoid layout clutter.
- **Loading feedback**:
  - `isLoading` (no cached data yet, e.g. very first page load) → full-page loading state replaces the list area.
  - `useNotesQuery().isFetching && !isLoading` (page/sort/filter change with `keepPreviousData` active) → a small inline "Updating…" indicator is shown alongside the still-visible previous list.
- **Error & Retry Handling**: If `useNotesQuery` or `useTagsQuery` fails (network error or non-200 response), a visible error alert is rendered instead of the notes list, including a "Retry" button that calls the query's `refetch()` function to trigger a manual reload.
  This satisfies the spec's "visible loading feedback... while a request is in flight" scenario for both the initial load and subsequent param changes, without discarding already-rendered data unnecessarily.

### 6. Routing change

`AppRouter.tsx`'s `/` route element changes from `<ProtectedRoute><AuthenticatedPlaceholderPage /></ProtectedRoute>` to `<ProtectedRoute><NotesListPage /></ProtectedRoute>`. `AuthenticatedPlaceholderPage.tsx` and `AuthenticatedPlaceholderPage.test.tsx` are deleted; their three scenarios (authenticated access, unauthenticated redirect, logout) are re-covered by `NotesListPage`'s tests via the "Authenticated Header and Logout" requirement plus the existing `ProtectedRoute` component (unchanged, still tested through its own behavior).

### 7. Testing approach

- Extend `frontend/src/test/mocks/handlers.ts` with `GET /api/notes` and `GET /api/tags` MSW handlers that honor `page`/`limit`/`sortBy`/`sortOrder`/`tags` query params against an in-memory fixture list, so pagination/sort/filter scenarios can be asserted against real request/response cycles.
- Component tests for `NotesListPage` (and small unit tests for `PaginationControls`/`TagFilterControls`/`EmptyState` where isolated logic warrants it) render with a fresh `QueryClient` per test (`retry: false`, `staleTime: 0`) to avoid cross-test cache bleed, following the same MSW + RTL + `userEvent` pattern already used in `frontend/src/features/auth/*.test.tsx`.
- Every scenario in `notes-list-ui/spec.md` maps to exactly one uniquely named test, per NFR-003/FR-INFRA-005.

## Risks / Trade-offs

- **[Risk]** First-ever use of `QueryClientProvider` in this codebase → could reveal integration gaps (e.g., missing provider in existing test render helpers). **Mitigation**: add the provider at the true app root (`main.tsx`) so every future route inherits it, and give `NotesListPage.test.tsx` its own local `QueryClientProvider` wrapper (test-only), matching how `MemoryRouter` is already added locally in page tests today.
- **[Risk]** Deleting `AuthenticatedPlaceholderPage` removes already-tested, working logout/protected-route behavior. **Mitigation**: the replacement `NotesListHeader` reuses the same `logout()` function unchanged, and the same three behavioral scenarios are re-asserted against `NotesListPage` before the old test file is removed.
- **[Risk]** `placeholderData: keepPreviousData` could make a subsequent load look like nothing happened if the "Updating…" indicator is missed by a screen reader or easy to overlook. **Mitigation**: the indicator is a visible, always-rendered-when-fetching element (not purely a CSS transition), satisfying the "visible loading feedback" requirement text directly.
- **[Risk]** Tag-filter query-string construction (`tags=id1,id2`) must match the backend's exact comma-separated format (`listNotesQuerySchema`). **Mitigation**: build the query params through a single shared helper in `notesApi.ts` so the encoding logic exists in one place, not duplicated across the page and hook.

## Migration Plan

Pure frontend change; no database migration, no backend deployment, no feature flag. Ships as a normal frontend build once merged. Rollback is a plain revert of the commit(s) — no data or schema changes to unwind.

## Open Questions

None blocking. Exact Tailwind visual styling of the new components is left to implementation, following the visual conventions already established by the AB-1010 auth pages (e.g. `AuthenticatedPlaceholderPage`'s card/button styling) for consistency.
