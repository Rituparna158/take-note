## Why

`GET /api/search` already supports authenticated full-text note search with pagination and `<mark>`-based highlight snippets (AB-1007), but no frontend interface consumes it. Users currently have no way to search their notes from the UI. This ticket delivers the frontend search interface required by FR-UI-SEARCH-001.

## What Changes

- Add a dedicated `/search` route (inside the existing `ProtectedRoute` wrapper) containing a search page: a keyword input, an explicit submit action (Enter key or a Search button), a result list, pagination controls, and a query error/empty state.
- Submitting a keyword calls `GET /api/search` (via a new TanStack Query hook) using the existing `packages/shared` `searchQuerySchema`/`searchResponseSchema` — no new shared types are introduced.
- Each search result displays the note's title and its `highlight` snippet; the snippet's `<mark>`-wrapped HTML is sanitized with DOMPurify before being rendered (per SDS §4.2), so matched keywords are visually distinguished.
- Search results are paginated using the same page-based pagination pattern as the notes list (reusing the existing `PaginationControls` component); changing page re-fetches the current keyword at the requested page.
- Selecting a search result navigates to that note's editor route (`/notes/:id`), consistent with how the notes list links to the editor.
- Display visible loading feedback while a search request is in flight, a visible error state (with retry) if the request fails, and a visible empty-state message when a submitted keyword matches zero notes.
- Before any keyword has been submitted, the page shows an idle prompt state (no request is made and no result list or empty-state message is shown).
- Add a "Search" link to the existing `NotesListHeader`, navigating to `/search`.

## Capabilities

### New Capabilities

- `search-ui`: Frontend search page — keyword input with explicit submit, results list with sanitized highlight snippets, pagination, loading/error/empty/idle states, and result-to-editor navigation, plus the header nav entry point.

### Modified Capabilities

_None — this ticket only adds a frontend UI on top of the existing `note-search` backend capability; no backend requirement changes._

## Impact

- **New frontend code**: search page component, a search TanStack Query hook, a search-result-item component (with sanitized highlight rendering), all under `frontend/src/features/search/`.
- **Modified frontend code**: `AppRouter.tsx` adds the `/search` route; `NotesListHeader.tsx` adds a "Search" nav link.
- **No backend or shared-package API changes** — consumes the existing `GET /api/search` endpoint and existing shared DTOs/schemas as-is.
