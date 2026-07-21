## Why

Authenticated users currently land on a minimal placeholder page after login/registration (AB-1010) with no way to see their notes. `GET /api/notes` and `GET /api/tags` already support pagination, sorting, and tag filtering (AB-1004/AB-1005/AB-1006), but no frontend interface consumes them. This ticket delivers the notes list page, replacing the placeholder as the authenticated landing route and giving users their first view into their own notes.

## What Changes

- Add a notes list page that becomes the authenticated landing route at `/`, **replacing** `AuthenticatedPlaceholderPage` (removed) and its route registration in `AppRouter.tsx`.
- Carry forward the logout capability from the removed placeholder page into a minimal header/nav bar on the notes list page, showing the signed-in user's email and a logout control (calls `POST /api/auth/logout`, clears `AuthStore`, navigates to `/login`).
- Fetch and display the authenticated user's active notes via `GET /api/notes` (title, tags, updated/created timestamps), using TanStack Query for server state and caching.
- Add pagination controls driven by the response `meta` (`page`, `limit`, `totalCount`, `totalPages`); changing page re-fetches the corresponding page of notes.
- Add sorting controls for `sortBy` (`createdAt` | `updatedAt`) and `sortOrder` (`asc` | `desc`), re-fetching notes on change.
- Add tag-filter controls populated from `GET /api/tags` (all of the user's tags, regardless of active-note count), supporting selection of multiple tags; selected tags are sent as the comma-separated `tags` query parameter and combine with pagination/sorting.
- Display visible loading feedback while notes (or tags) are being fetched, and a visible empty-state message when zero notes match the current page/filter combination (including when the user has no notes at all).
- Notes are display-only in this ticket: selecting/clicking a note has no navigation effect and no "create note" entry point is added — both are AB-1012's scope (the rich-text editor).
- All new request/response shapes are consumed as-is from the existing `packages/shared` schemas (`noteListResponseSchema`, `noteResponseSchema`, `listNotesQuerySchema`, `tagListResponseSchema`) — no new shared types are introduced.

## Capabilities

### New Capabilities

- `notes-list-ui`: Frontend notes list page — active-notes display, pagination controls, sorting controls, multi-tag filter controls, loading feedback, empty-state feedback, and the carried-forward logout header, replacing the AB-1010 placeholder as the authenticated landing route.

### Modified Capabilities

_None — this ticket only adds a frontend UI on top of the existing `note-management` and `tag-management` backend capabilities; no backend requirement changes. The `auth-ui` capability's placeholder-page requirement is superseded at the routing level but its own spec text is not edited by this change._

## Impact

- **New frontend code**: notes list page component, pagination controls, sorting controls, tag-filter controls, a notes-list TanStack Query hook, and a minimal header/logout component, all under `frontend/src/`.
- **Removed frontend code**: `AuthenticatedPlaceholderPage` and its test are deleted; its route in `AppRouter.tsx` is replaced by the notes list page.
- **Modified frontend code**: `AppRouter.tsx` updated so `/` renders the notes list page inside the existing `ProtectedRoute` wrapper.
- **No backend or shared-package API changes** — consumes the existing `GET /api/notes` and `GET /api/tags` endpoints and existing shared DTOs/schemas as-is.
