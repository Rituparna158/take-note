## Why

AB-1004 shipped a minimal `GET /api/notes` that returns a user's entire active-note set in one unpaginated, unsorted response. As a user's note count grows, this does not scale and gives users no way to order or narrow their list. FR-NOTE-006, FR-NOTE-007, and FR-NOTE-008 require pagination, sorting, and tag-based filtering on the active-notes list before the Notes List frontend (AB-1011) can be built against it.

## What Changes

- `GET /api/notes` accepts `page` and `limit` query parameters and returns a real paginated slice of the user's active notes, with `meta.totalCount`/`meta.page`/`meta.limit`/`meta.totalPages` reflecting the full result set (not just the returned page).
- `GET /api/notes` accepts `sortBy` (`createdAt` | `updatedAt`, default `updatedAt`) and `sortOrder` (`asc` | `desc`, default `desc`) query parameters to control note ordering.
- `GET /api/notes` accepts a `tags` query parameter (comma-separated tag IDs) that filters results to active notes associated with **all** specified tags (AND semantics), combinable with pagination.
- Invalid `page`, `limit`, `sortBy`, `sortOrder`, or malformed (non-UUID) `tags` values are rejected with `400 VALIDATION_ERROR`.
- A `page` beyond the last available page returns `200 OK` with an empty `data` array and accurate `meta`.
- Tag filtering is scoped to the requesting user: only `NoteTag` associations on the user's own notes are considered, so a tag ID that does not belong to the user (or does not exist) naturally yields no matches rather than an error.
- Note responses continue to omit a `tags` field (deferred to AB-1006, consistent with the AB-1004 scope decision) — this ticket only adds the `tags` filter query parameter, not tag display.
- `listActiveNotes` (service layer) is rewritten to build a dynamic Prisma `where`/`orderBy`/`skip`/`take` query instead of returning every active note.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `note-management`: the "Read Note" list behavior (`GET /api/notes`) gains pagination, sorting, and multi-tag filtering, per FR-NOTE-006, FR-NOTE-007, and FR-NOTE-008.

## Impact

- `backend/src/routes/notes.ts` — `GET /` handler parses and validates new query parameters.
- `backend/src/services/noteService.ts` — `listActiveNotes` signature and Prisma query change.
- `packages/shared/src/notes/schemas.ts` — add a `listNotesQuerySchema` (or equivalent) for `page`/`limit`/`sortBy`/`sortOrder`/`tags` validation, shared between backend validation and frontend query building.
- No Prisma schema/migration changes — `Tag`/`NoteTag` models already exist from AB-1001.
- No changes to create/update/delete/restore note endpoints.
