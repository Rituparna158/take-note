## Why

Users currently have no way to let someone else view a note without giving them account access. AB-1008 delivers backend public read-only sharing — a note owner can generate a link that anyone can open without authentication, with owner-controlled expiration, revocation, and view tracking — ahead of the frontend sharing UI (AB-1014).

## What Changes

- Add `POST /api/notes/:id/share` — authenticated, owner-only. Generates a new public share link for the note. Accepts an optional `expiresInDays` (integer, 1–30); if omitted, defaults to 7 days. Always mints a fresh cryptographically secure token and revokes any prior active `ShareLink` for the note first, so at most one link is ever active per note. The plaintext token is returned to the owner exactly once, embedded in a full URL built from `WEB_ORIGIN`; only its SHA-256 hash is persisted.
- Add `DELETE /api/notes/:id/share` — authenticated, owner-only. Revokes the note's currently active share link (`revoked = true`). Returns `404 NOT_FOUND` if the note has no active share link.
- Add `GET /api/share/:token` — public, unauthenticated. Hashes the incoming token and looks up the matching `ShareLink`. Returns the note's `title`, `content`, and `updatedAt` on success. Rejects with `403 FORBIDDEN` if the link is expired or revoked, and `404 NOT_FOUND` if the token doesn't match any link, the note has been permanently purged, or the note is currently soft-deleted (soft-deleted notes are treated as not found from the public visitor's perspective, per FR-SHARE-005). On success, atomically increments `viewCount` via Prisma's `increment` update operator so concurrent views are never lost.
- Add a new rate limiter for `GET /api/share/:token` (60 requests/minute, keyed on IP + token) — the only new limiter needed, since the owner-facing POST/DELETE endpoints are already covered by the existing global "Standard Authenticated API" limiter under `/api/notes/*`.
- No read endpoint for the owner to check current share-link status is added in this ticket (e.g. no `GET /api/notes/:id/share`) — deferred to AB-1014 if the frontend sharing UI needs it.

## Capabilities

### New Capabilities

- `note-sharing`: Public read-only note sharing — link generation with owner-configurable expiration (default 7 days, range 1–30), revocation, unauthenticated public access, atomic view counting, and exclusion of soft-deleted notes from public access.

### Modified Capabilities

(none — this ticket introduces a new capability and does not change the requirements of `note-management`, `tag-management`, or `note-search`)

## Impact

- **Database**: adds the `ShareLink` model (`id`, `noteId`, `tokenHash` unique, `expiresAt`, `viewCount`, `revoked`, `createdAt`, `updatedAt`) with an index on `noteId`, deployed via a Prisma migration applied to both `notes_dev` and `notes_test`.
- **Backend**: new `share` domain — a `shareRouter` mounted at `/api/notes/:id/share` (owner-facing, behind `authenticateToken`) and `/api/share` (public, no auth), a `shareService` implementing token generation/hashing, expiration/revocation checks, and the atomic view-count increment, reusing existing note-ownership and soft-delete rules.
- **Shared package**: new Zod schemas/types for the share-link creation request (`expiresInDays`), the owner-facing share-link response DTO, and the public share-view response DTO, added under `packages/shared`.
- No frontend changes (share UI is AB-1014) and no changes to existing note, tag, or search endpoints.
