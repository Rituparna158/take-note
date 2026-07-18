## 1. Shared Package: Tag DTOs & Schemas

- [x] 1.1 Create `packages/shared/src/tags/schemas.ts`: `createTagRequestSchema`, `updateTagRequestSchema` (`name`/`color` as trimmed non-empty strings), `tagResponseSchema` (`{ id, name, color }`), `tagWithCountResponseSchema` (`tagResponseSchema` + `_count: { notes }`), `tagListResponseSchema` (array of `tagWithCountResponseSchema`). _(Design Decision 7; FR-TAG-001–002.)_
- [x] 1.2 Write `packages/shared/src/tags/schemas.test.ts` covering valid/invalid payloads for each new schema.
- [x] 1.3 Update `packages/shared/src/notes/schemas.ts`: add optional `tagIds: z.array(z.uuid())` to `createNoteRequestSchema` and `updateNoteRequestSchema`; add `tags: z.array(tagResponseSchema)` to `noteResponseSchema`, importing `tagResponseSchema` from `../tags/schemas.js` (no duplicate DTO). _(Design Decisions 4 and 6; note-management delta spec.)_
- [x] 1.4 Update `packages/shared/src/notes/schemas.test.ts` for the new `tagIds`/`tags` fields (valid, omitted, and empty-array cases).
- [x] 1.5 Update `packages/shared/src/index.ts` to export the new tag schemas and inferred types.
- [x] 1.6 Quality gates for this phase: `pnpm --filter shared build` → `pnpm --filter shared lint --max-warnings 0` → `pnpm --filter shared test`.

## 2. Database: Case-Insensitive Tag Name Index

- [x] 2.1 Run `npx prisma migrate dev --create-only --name add_tag_lower_name_index` to scaffold an empty migration. _(Design Decision 10.)_
- [x] 2.2 Hand-edit the generated migration file to add `CREATE UNIQUE INDEX "Tag_userId_lower_name_key" ON "Tag" ("userId", LOWER("name"));`, per SDS §6.1/§7.
- [x] 2.3 Apply the migration to both `notes_dev` and `notes_test` (dual-database convention, AGENTS.md §4) and run `npx prisma generate`.

## 3. Backend: Tag Service

- [x] 3.1 Create `backend/src/services/tagService.ts`: `createTag`, `listTagsWithCounts`, `updateTag`, `deleteTag`, and `assertTagsOwnedByUser`, implementing the uniqueness enforcement strategy from Design Decision 2 (application-level case-insensitive find + `23505` unique violation catch), ownership checks returning `403 FORBIDDEN`/`404 NOT_FOUND` (Decision 8), and the `groupBy` active-note-count aggregate (Decision 7). No direct Prisma access from route files. _(FR-TAG-001–004.)_ — **Candidate for subagent delegation** (multiple non-trivial functions with distinct error-handling paths; likely exceeds 45 minutes).
- [x] 3.2 Write backend integration tests: `tags.create.test.ts`, `tags.list.test.ts`, `tags.update.test.ts`, `tags.delete.test.ts` against `notes_test`, one uniquely named test per FR-TAG-001–004 acceptance-criteria scenario (13 scenarios total across the four requirements). — **Candidate for subagent delegation** based on volume (likely exceeds 45 minutes), though implement directly per this project's established practice of not delegating test-writing.

## 4. Backend: Tags Router

- [x] 4.1 Create `backend/src/routes/tags.ts`: `POST /`, `GET /`, `PUT /:id`, `DELETE /:id`, with `authenticateToken` applied the same way `notesRouter` applies it, and Zod validation/`zodIssuesToFields` error mapping matching the `notes.ts` pattern. _(Design Decision 1.)_
- [x] 4.2 Mount `tagsRouter` at `/api/tags` in `backend/src/app.ts` (no new rate limiter — relies on the existing global limiter, Decision 9).
- [x] 4.3 Write `backend/src/routes/tags.rateLimit.test.ts` (or extend an existing rate-limit test) confirming `/api/tags/*` is governed by the existing global limiter, mirroring `notes.rateLimit.test.ts`.

## 5. Backend: Note–Tag Association Wiring

- [x] 5.1 Modify `backend/src/services/noteService.ts`: `createNote` accepts `tagIds`, validates ownership via `tagService.assertTagsOwnedByUser`, writes via nested `create`; `updateNote` replaces associations via `$transaction([deleteMany, createMany])` only when `tagIds` is present (Decision 4/5); `toNoteResponse` maps the `tags` relation to `{ id, name, color }[]`; add `include: { tags: { include: { tag: true } } }` to `createNote`, `getActiveNoteById`, `listActiveNotes`, and `updateNote`. _(Design Decisions 3, 4, 5, 6; note-management delta spec.)_ — **Candidate for subagent delegation** (touches every note read/write path; likely exceeds 45 minutes).
- [x] 5.2 Modify `backend/src/routes/notes.ts` to pass the now-validated `tagIds` field through to `createNote`/`updateNote` (no new validation logic needed — the updated shared schemas already validate shape).
- [x] 5.3 Extend `notes.create.test.ts` and `notes.update.test.ts` with the new tag-association and tag-ownership-rejection scenarios from the note-management delta spec; extend `notes.list.test.ts` and `notes.read.test.ts` to assert the `tags` field is present and correct.

## 6. Quality Gates & Manual Verification

- [x] 6.1 Run full workspace quality gates in order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`. Do not proceed past a failing checkpoint (AGENTS.md §4.3).
- [x] 6.2 Confirm ≥80% automated test coverage on new/changed code (AGENTS.md §10).
- [x] 6.3 Manual smoke test per design.md Testing Strategy: create tag → create note with that tag → read/list note shows the tag → list tags shows count 1 → update tag name → delete tag → note remains and is tag-less; plus error paths (case-insensitive duplicate name, cross-user tag update/delete, a `tagIds` entry not owned by the caller on note create/update).
