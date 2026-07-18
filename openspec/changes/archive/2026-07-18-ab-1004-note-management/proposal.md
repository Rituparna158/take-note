## Why

Authenticated users currently have no way to create or manage personal notes — the `Note` table exists in the schema but no API or service layer operates on it. AB-1004 is next in the mandatory ticket sequence (AB-1001–AB-1003 complete) and delivers the core note data lifecycle (create, read, update, soft delete, restore, automatic purge) that every later ticket (tagging, search, sharing, versioning) builds on top of.

## What Changes

- Add `POST /api/notes` — create a note (title + TipTap JSON content only; no tag association in this ticket).
- Add `GET /api/notes` — list the authenticated user's active notes. Minimal in this ticket: returns all active notes owned by the caller, with no pagination, sorting, or tag-filter query params (those are AB-1005's scope per FRS §18/§17).
- Add `GET /api/notes/:id` — retrieve a single active note owned by the caller.
- Add `PUT /api/notes/:id` — update title/content of the caller's own active note.
- Add `DELETE /api/notes/:id` — soft delete (`deletedAt = now()`) the caller's own note.
- Add `POST /api/notes/:id/restore` — restore the caller's own soft-deleted note within the 30-day recovery window.
- Add a `noteService` layer enforcing ownership (403 on another user's note, 404 on missing/soft-deleted/purged note per AGENTS.md §8) and soft-delete semantics.
- Add plain-text extraction from TipTap JSON content into `Note.bodyText` on create/update (custom extractor, no new dependency — `bodyText` is populated now so the column is correctly maintained ahead of AB-1007 search, but no search functionality is implemented in this ticket).
- Add an automatic daily purge job (`purgeNotes.ts`) using `node-cron` (new pinned dependency) reading `PURGE_CRON_SCHEDULE`, permanently deleting notes where `deletedAt <= now() - 30 days` (FR-NOTE-009). Cascade deletes of `NoteTag`/`ShareLink`/`NoteVersion` are already handled by existing DB-level `onDelete: Cascade` constraints.
- Add shared Zod schemas/DTOs for note create/update/response payloads in `packages/shared` (title: trimmed non-empty string; content: structurally valid TipTap JSON document — no invented length or emptiness constraints beyond what FR-NOTE-001 states).
- Mount the new `/api/notes` router behind `authenticateToken` and the SDS §5 "Standard Authenticated API" rate limiter (1000 req/15min), keyed on the authenticated user's ID.

Explicitly out of scope for this ticket (deferred to later tickets in the mandatory sequence):

- Tag association on notes (`tagIds`) — AB-1006.
- Pagination, sorting, and tag-filtering on the list endpoint — AB-1005.
- Full-text search — AB-1007.

## Capabilities

### New Capabilities

- `note-management`: Authenticated CRUD lifecycle for personal notes — create, read (single + basic list), update, soft delete, restore, and automatic permanent purge of long-soft-deleted notes.

### Modified Capabilities

_None._ The `Note` table and its indexes already exist from AB-1001's initial migration; no schema changes are required.

## Impact

**Backend (new files):**

- `backend/src/routes/notes.ts` — Express router for `/api/notes/*`.
- `backend/src/services/noteService.ts` — ownership checks, soft delete/restore, bodyText extraction.
- `backend/src/lib/tiptapText.ts` — TipTap JSON → plain-text extractor.
- `backend/src/jobs/purgeNotes.ts` — `node-cron` scheduled purge job.

**Backend (modified files):**

- `backend/src/app.ts` — mount `/api/notes` router in the existing middleware chain (after `authenticateToken`, before the global error handler); start the purge cron job.
- `backend/package.json` — add pinned `node-cron` dependency (+ `@types/node-cron`).

**Shared:**

- `packages/shared/src/notes/schemas.ts` (new) — Zod schemas/DTOs for note create/update/response.
- `packages/shared/src/index.ts` — export new note schemas/types.

**Tests:**

- New Vitest + Supertest integration suites for each endpoint's happy path, ownership rejection (403), not-found/soft-deleted (404) cases, and the purge job's cascade behavior.

**Requirements covered:** FR-NOTE-001, FR-NOTE-002, FR-NOTE-003, FR-NOTE-004, FR-NOTE-005, FR-NOTE-009 (ticket AB-1004 per FRS §17/§18); NFR-004 (security), NFR-005 (data isolation).
