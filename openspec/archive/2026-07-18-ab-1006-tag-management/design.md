## Context

`Tag` and `NoteTag` already exist in the Prisma schema (created in AB-1001's initial migration), backed only by a plain `@@unique([name, userId])` index — there is no case-insensitive functional index yet (SDS §6.1 calls for one, added via a raw-SQL migration). No `/api/tags` routes exist. `backend/src/routes/notes.ts` / `backend/src/services/noteService.ts` (AB-1004/1005) only handle `title`/`content`; they have no awareness of tags, and `noteResponseSchema` has no `tags` field.

The existing `authService.registerUser` (email uniqueness) already establishes this project's pattern for a per-scope uniqueness check: look up a conflicting row first, throw `AppError(422, "CONFLICT", ...)` if found, otherwise proceed with the write. This design reuses that pattern for tags rather than introducing a new one.

## Goals / Non-Goals

**Goals:**

- Implement `POST /api/tags`, `GET /api/tags`, `PUT /api/tags/:id`, `DELETE /api/tags/:id` per SDS §3.3, satisfying FR-TAG-001 through FR-TAG-004.
- Enforce tag-name uniqueness within the user's scope (with case-insensitive comparison and trimming applied as implementation choices).
- Wire `tagIds` into `POST /api/notes` / `PUT /api/notes/:id`, and a `tags` array into every note response shape, validating that every referenced tag belongs to the authenticated user (approved during `/spec`).
- Compute active-note counts per tag via a single aggregated query (SDS §6.2), not N+1 lookups.

**Non-Goals:**

- Tag color format validation beyond "non-empty string" (approved during `/spec`).
- Pagination of the tag list (SDS §3.3.2 returns a plain array).
- Any frontend work (AB-1010+), search/sharing/version-history integration (later tickets in the mandatory sequence).

## Decisions

### 1. Router/service layout

New `backend/src/routes/tags.ts` (Router, `authenticateToken` applied the same way `notesRouter` does it) mounted at `/api/tags` in `app.ts`, plus new `backend/src/services/tagService.ts` for all `Tag`/`NoteTag` Prisma access. Matches the existing one-router-per-domain / no-Prisma-in-routes conventions in `backend/CLAUDE.md`.

### 2. Tag-name uniqueness implementation

- **Uniqueness Requirement Context**: The functional requirement (FR-TAG-001) states only that tag names must be unique within the authenticated user's own scope. Case-insensitive comparison and trimming of leading/trailing whitespace are implementation and technical design choices made to robustly satisfy this uniqueness requirement.
- **Application-level check**: `tagService` trims the incoming name and pre-checks with `prisma.tag.findFirst({ where: { userId, name: { equals: trimmedName, mode: "insensitive" } } })` — Prisma's documented Postgres-only case-insensitive filter mode (verified against current Prisma docs). This mirrors `authService.registerUser`'s existing check-then-`AppError(422, "CONFLICT", ...)` pattern, excluding the tag's own row on update.
- **DB-level safety net**: a `prisma migrate dev --create-only` migration adds a raw-SQL unique functional index, `CREATE UNIQUE INDEX "Tag_userId_lower_name_key" ON "Tag" ("userId", LOWER("name"))`, per SDS §6.1/§7. The service catches the resulting Postgres unique-violation (error code `23505`) on create/update and maps it to the same `AppError(422, "CONFLICT", ...)`, so a race between two concurrent requests can't slip through as a 500.
- Both mechanisms encode the identical rule (trim + case-insensitive), so there is no behavioral drift between the common-case check and the race-condition fallback.

### 3. Tag-ownership validation for note association

`tagService` exports `assertTagsOwnedByUser(userId, tagIds): Promise<void>`, which de-duplicates the incoming IDs, queries `prisma.tag.findMany({ where: { id: { in: uniqueIds }, userId } })`, and throws `AppError(422, "CONFLICT", "One or more tags do not belong to you")` if the returned count is short. `noteService.createNote`/`updateNote` call this before writing any `NoteTag` rows. This is a service-to-service call (not router-to-router), keeping each router domain-scoped per `backend/CLAUDE.md` while letting `noteService` reuse `tagService`'s ownership logic instead of re-querying `Tag` directly.

### 4. `tagIds` replace-vs-untouched semantics on notes

`tagIds` is optional on both `POST /api/notes` and `PUT /api/notes/:id`:

- **Create**: if provided (including `[]`), the note is associated with exactly those tags; if omitted, the note has no tags.
- **Update**: if provided (including `[]`), the note's tag associations are fully replaced with exactly the given set; if the field is omitted from the request body entirely, existing tag associations are left untouched.
- Duplicate IDs in the input are de-duplicated before writing, since `(noteId, tagId)` is a composite primary key on `NoteTag`.

This keeps `PUT`'s existing full-replace behavior for `title`/`content` while treating the newly-added optional field as "untouched if not sent" — the least surprising choice for a field being added to an already-shipped endpoint, and avoids forcing every existing caller to start sending `tagIds: []` just to keep their notes untagged-and-unchanged.

### 5. Prisma writes for note-tag association

- **Create**: single `prisma.note.create({ data: { ..., tags: { create: dedupedIds.map(tagId => ({ tagId })) } }, include: { tags: { include: { tag: true } } } })`.
- **Update** (only when `tagIds` is present in the parsed body): `prisma.$transaction([ prisma.noteTag.deleteMany({ where: { noteId } }), prisma.noteTag.createMany({ data: dedupedIds.map(tagId => ({ noteId, tagId })) }) ])`, followed by re-reading the note with the same `tags.tag` include for the response. When `tagIds` is absent, neither step runs.

### 6. Note response shape

`noteResponseSchema` (in `packages/shared/src/notes/schemas.ts`) gains `tags: TagResponse[]`, importing and reusing `tagResponseSchema` (`{ id, name, color }`) from the new `packages/shared/src/tags/schemas.ts` instead of redeclaring an equivalent shape (per `packages/shared/CLAUDE.md`'s no-duplication rule). `noteService.toNoteResponse` maps the note's `tags` relation (`NoteTag[]`, each with a nested `tag`) to `{ id, name, color }[]`. `createNote`, `getActiveNoteById`, `listActiveNotes`, and `updateNote` all add `include: { tags: { include: { tag: true } } }` so every note-returning endpoint populates the field consistently.

### 7. Tag CRUD response shapes

Match SDS §3.3 literally:

- `POST /api/tags` / `PUT /api/tags/:id` → `{ id, name, color }` (no `_count`).
- `GET /api/tags` → a plain array (no `{ data, meta }` wrapper) of `{ id, name, color, _count: { notes: number } }`.
- Active-note counts are computed with one aggregate query per SDS §6.2: `prisma.noteTag.groupBy({ by: ["tagId"], where: { note: { userId, deletedAt: null } }, _count: { tagId: true } })`, then joined in-memory against the user's tag list — avoiding an N+1 per-tag count query.

### 8. Tag delete

`tagService.deleteTag` loads the tag by ID, throws `403 FORBIDDEN` if it belongs to another user (or `404 NOT_FOUND` if it doesn't exist), then `prisma.tag.delete({ where: { id } })`. `NoteTag` rows cascade automatically via the schema's existing `onDelete: Cascade` — no manual cleanup step. Associated notes are untouched by construction (deleting `NoteTag` rows doesn't touch `Note` rows).

### 9. Rate limiting

No new limiter. `/api/tags/*` is covered by the existing global 1000-requests/15-minutes limiter already wired in `app.ts` (SDS §5's "Standard Authenticated API" row already lists `/api/tags/*`); adding a per-route limiter here would duplicate that baseline.

### 10. Migration procedure

`npx prisma migrate dev --create-only --name add_tag_lower_name_index`, then hand-edit the generated migration file to add the raw `CREATE UNIQUE INDEX` statement (the project's established approach for raw-SQL-only schema dependencies, per SDS §7). Apply to both `notes_dev` and `notes_test` per the project's dual-database migration convention (AGENTS.md §4).

## API Endpoints Involved

- `POST /api/tags`, `GET /api/tags`, `PUT /api/tags/:id`, `DELETE /api/tags/:id` — new, `tagsRouter`.
- `POST /api/notes`, `PUT /api/notes/:id` — modified: accept `tagIds`, return `tags`.
- `GET /api/notes`, `GET /api/notes/:id` — modified: return `tags` only (no request-shape change).

## Files to Create / Modify

- New: `backend/src/routes/tags.ts`, `backend/src/services/tagService.ts`.
- New: `packages/shared/src/tags/schemas.ts` (+ `schemas.test.ts`).
- New: `backend/prisma/migrations/<timestamp>_add_tag_lower_name_index/migration.sql`.
- Modify: `backend/src/app.ts` (mount `tagsRouter` at `/api/tags`).
- Modify: `backend/src/routes/notes.ts` (accept/pass `tagIds`).
- Modify: `backend/src/services/noteService.ts` (tag association writes/reads, `assertTagsOwnedByUser` calls, response mapping).
- Modify: `packages/shared/src/notes/schemas.ts` (`tagIds` on requests, `tags` on response) and its test file.
- Modify: `packages/shared/src/index.ts` (export new tag schemas/types).

## Testing Strategy

- Backend integration tests (Vitest + Supertest against `notes_test`), one uniquely named test per FRS acceptance-criteria scenario, following the existing per-concern file convention (e.g. `tags.create.test.ts`, `tags.list.test.ts`, `tags.update.test.ts`, `tags.delete.test.ts`), plus updates to `notes.create.test.ts` / `notes.update.test.ts` / `notes.list.test.ts` / `notes.read.test.ts` for the new `tagIds`/`tags` fields.
- Shared-package unit tests for the new/updated Zod schemas.
- ≥80% coverage on new code, per AGENTS.md §10.
- Manual smoke test before completion: create tag → create note with that tag → read/list note shows the tag → list tags shows count 1 → update tag name → delete tag → note remains and is now tag-less; plus the defined error paths (duplicate name case-insensitively, cross-user tag update/delete, a `tagIds` entry not owned by the caller on note create/update).

## Risks / Trade-offs

- [Risk] Pre-check + functional index are two mechanisms enforcing the same uniqueness rule → could drift if only one is updated later. **Mitigation**: both apply the identical trim + case-insensitive rule; the index exists purely as a race-condition safety net behind the pre-check, not as an independent rule.
- [Risk] Replacing a note's tags via `deleteMany` + `createMany` in a transaction is two round trips instead of a single upsert. **Mitigation**: acceptable given the small number of tags per note; avoids pulling in additional tooling for a case this simple.
- [Risk] "Omitted `tagIds` leaves tags untouched, but an empty array clears them" is a subtle contract nuance. **Mitigation**: it is the only interpretation consistent with adding an optional field to an already-shipped `PUT` endpoint without breaking existing callers; call this out explicitly in the `/pr` description.

## Migration Plan

- Apply the new raw-SQL migration to both `notes_dev` and `notes_test`, per the project's dual-database convention.
- No data backfill required — no `Tag` rows are expected to exist yet in either database ahead of this feature.
- Rollback: `DROP INDEX "Tag_userId_lower_name_key"`. The application-level pre-check keeps working without the index (it just loses its race-condition safety net), so rollback doesn't leave the feature completely broken.

## Open Questions

None outstanding. Color format, name trimming/case-insensitivity, and tag-note wiring scope were resolved during `/spec`; `tagIds` replace-vs-untouched semantics and tag CRUD response shapes are resolved above (Decisions 4 and 7).
