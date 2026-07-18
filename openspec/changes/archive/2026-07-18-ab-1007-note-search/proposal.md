## Why

Users currently can only find a note by paging through their notes list or filtering by tag. As the note count grows, they need a way to jump directly to notes containing specific keywords, wherever those keywords appear across all of their notes — in a title or in the body content. AB-1007 delivers backend full-text search so that capability exists ahead of the frontend search UI (AB-1013).

## What Changes

- Add `GET /api/search` — an authenticated endpoint that full-text searches the caller's own active notes by keyword across `title` and `bodyText`.
- Search uses native PostgreSQL full-text search (`tsvector`/`plainto_tsquery`/`ts_headline`) against a generated, GIN-indexed search vector — no external search engine.
- Each result includes a `highlight` field: an HTML snippet (via `ts_headline`, `<mark>...</mark>` delimiters) built from the note's `bodyText`, showing keyword occurrences in context. The `title` field itself is always returned as plain text (matching the SDS's literal search query, which only runs `ts_headline` over `bodyText`).
- Each result includes the note's actual associated tags, in the same shape used by `GET /api/notes` — consistent with the rest of the note DTO.
- Results are scoped to the authenticated user's own active (non-soft-deleted) notes only, and support pagination (`page`, `limit`) with the same `{ data, meta }` envelope used by the notes list endpoint.
- A missing or whitespace-only `q` query parameter is rejected with `400 VALIDATION_ERROR`.
- No new rate limiter is introduced: `/api/search` is already covered by the existing global "Standard Authenticated API" limiter (1000 requests / 15 minutes, keyed on session) established in AB-1002.

## Capabilities

### New Capabilities

- `note-search`: Full-text keyword search across an authenticated user's own active notes (title + body), with keyword-highlighted results and pagination.

### Modified Capabilities

(none — this ticket introduces a new capability and does not change the requirements of `note-management` or `tag-management`)

## Impact

- **Database**: adds a generated `tsvector` column on `Note` (combining `title` and `bodyText`) backed by a GIN index, deployed via a raw-SQL Prisma migration (applied to both `notes_dev` and `notes_test`).
- **Backend**: new `search` domain — a `searchRouter` mounted at `/api/search`, a `searchService` (or equivalent) implementing the raw SQL query described in SDS §4.1, reusing `authenticateToken` and the existing note-ownership/soft-delete rules.
- **Shared package**: new Zod schemas/types for the search query parameters and search result DTO (including the `highlight` field), added under `packages/shared`, reusing the existing tag response schema.
- No frontend changes (search UI is AB-1013) and no changes to existing note, tag, or auth endpoints.
