## 1. Shared Package: Note DTOs & Validation

_Files: `packages/shared/src/notes/schemas.ts` (new), `packages/shared/src/index.ts` (modified). Ref: design.md §3, FR-NOTE-001._

- [x] 1.1 Implement the recursive TipTap content-node Zod schema (`type`, optional `attrs`, optional `content: Node[]`, optional `text`, optional `marks`) rooted at a `{ type: 'doc', content: Node[] }` document schema, per design.md §3 — structural validation only, no fixed node-type enum.
- [x] 1.2 Implement `createNoteSchema` / `updateNoteSchema`: `title` = `z.string().trim().min(1)`, `content` = the schema from 1.1. No `tagIds` field, no invented length/emptiness bounds beyond FR-NOTE-001.
- [x] 1.3 Implement the note response DTO type/schema: `{ id, title, content, createdAt, updatedAt }` (no `tags` field).
- [x] 1.4 Implement the `GET /api/notes` list response DTO: `{ data: NoteResponse[], meta: { totalCount, page, limit, totalPages } }` per design.md §6 (SDS §3.2.2 envelope).
- [x] 1.5 Export all new schemas/types from `packages/shared/src/index.ts`.
- [x] 1.6 Write Vitest unit tests for the schemas: valid TipTap doc accepted, malformed doc rejected, empty/whitespace-only title rejected, valid non-empty title accepted.
- [x] 1.7 Quality gate: `pnpm --filter @take-note/shared build && pnpm --filter @take-note/shared lint --max-warnings 0 && pnpm --filter @take-note/shared test`.

## 2. Backend: Dependencies & Plain-Text Extraction Utility

_Files: `backend/package.json` (modified), `backend/src/lib/tiptapText.ts` (new). Ref: design.md §4, §7._

- [x] 2.1 Add pinned `node-cron@4.6.0` to `backend/package.json` dependencies (no `@types/node-cron` — v4 ships its own types, per design.md §7). Run `pnpm install`.
- [x] 2.2 Implement `extractPlainText(content)` in `backend/src/lib/tiptapText.ts`: recursively walk the validated TipTap content tree, concatenate `text`-node values, join across block-level siblings with a single space.
- [x] 2.3 Write Vitest unit tests for `extractPlainText`: single paragraph, multiple nested block/mark nodes, empty document, adjacent block nodes not running words together.

_Independent of Section 1 — may be implemented in parallel by a second subagent if desired, since neither depends on the other's output before Section 3 begins._

## 3. Backend: Note Service Layer

_Files: `backend/src/services/noteService.ts` (new). Ref: design.md §1, §2, §5; FR-NOTE-001–005, FR-NOTE-009. Depends on: 1, 2._
**Candidate for subagent delegation (>45 min): implements 6 operations plus the shared ownership/lifecycle precedence logic exactly once, reused by all of them.**

- [x] 3.1 Implement `createNote(userId, input)`: extract `bodyText` via `extractPlainText`, persist via Prisma, return the response DTO.
- [x] 3.2 Implement the shared ownership/lifecycle lookup helper per design.md §2 precedence: (a) not found in DB → `NOT_FOUND`; (b) found but `userId` mismatch → `FORBIDDEN`; (c) found, owned, wrong lifecycle state for the requested operation → `NOT_FOUND`; (d) otherwise proceed. Used by every operation below.
- [x] 3.3 Implement `getActiveNoteById(userId, noteId)` using the helper, requiring `deletedAt IS NULL`.
- [x] 3.4 Implement `listActiveNotes(userId)`: `WHERE userId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC`, returning the `{ data, meta }` shape from design.md §6 with `page: 1`, `limit: totalCount`, `totalPages: 1`. Apply this formula uniformly, including the zero-result case (`totalCount: 0` → `data: []`, `meta: { totalCount: 0, page: 1, limit: 0, totalPages: 1 }`) — no special-cased empty-list branch that deviates from the same `{ data, meta }` contract.
- [x] 3.5 Implement `updateNote(userId, noteId, input)` using the helper (requires `deletedAt IS NULL`), re-extracting `bodyText`.
- [x] 3.6 Implement `softDeleteNote(userId, noteId)` using the helper (requires `deletedAt IS NULL`), sets `deletedAt = new Date()`. Returns `void` — per SDS §3.2.5 the route responds with a plain `{ message }` body, not a note object.
- [x] 3.7 Implement `restoreNote(userId, noteId)` using the helper (requires `deletedAt IS NOT NULL`), sets `deletedAt = null`. Returns `void` — per SDS §3.2.6 the route responds with a plain `{ message }` body, not a note object.
- [x] 3.8 Quality gate: `pnpm --filter backend build` (also ran lint and the full existing test suite as a regression check — 80/80 passing, no noteService-specific tests yet; those are covered end-to-end by Section 6's route-level integration tests).

## 4. Backend: Routes & Rate Limiting

_Files: `backend/src/routes/notes.ts` (new), `backend/src/app.ts` (modified). Ref: design.md §1, §8, §9; SDS §5, §10. Depends on: 3._

- [x] 4.1 Implement `backend/src/routes/notes.ts`: thin handlers for `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/restore` — validate via the shared Zod schemas, call `noteService`, map service errors to the standard `{ code, message, fields? }` shape via the existing global error handler (no ad hoc payloads, no manual try/catch-to-next per Express 5 convention).
- [x] 4.2 ~~Implement a notes-specific rate limiter~~ — **superseded**: the existing global "Standard Authenticated API" limiter registered in `backend/src/app.ts` during AB-1002 already covers `/api/notes/*` automatically once the router is mounted (task 4.3). No new limiter code is added; see design.md §8.
- [x] 4.3 Mount the `/api/notes` router in `backend/src/app.ts` inside the existing routes slot, after `authenticateToken`, preserving the fixed middleware order (AGENTS.md §5).
- [x] 4.4 Quality gate: `pnpm --filter backend build && pnpm --filter backend lint --max-warnings 0`.

## 5. Backend: Automatic Purge Job

_Files: `backend/src/lib/logger.ts` (new — no standalone Pino logger instance existed before this ticket; only inline request-scoped `pinoHttp()` middleware did), `backend/src/jobs/purgeNotes.ts` (new), `backend/src/server.ts` (modified). Ref: design.md §7; FR-NOTE-009; SDS §2.1, §8._

- [x] 5.1 Implement `purgeExpiredNotes()` in `backend/src/jobs/purgeNotes.ts`: `prisma.note.deleteMany({ where: { deletedAt: { lte: <now - 30 days> } } })`, log the purged row count via the new shared `logger.ts` (Pino). Export it standalone (not only as a cron callback) so tests can invoke it directly.
- [x] 5.2 Register the job in `backend/src/server.ts`: validate `PURGE_CRON_SCHEDULE` with `cron.validate()` at startup (fail fast on a missing or malformed expression), then `cron.schedule(PURGE_CRON_SCHEDULE, purgeExpiredNotes)` (async errors from a missed tick are caught and logged, not left unhandled).
- [x] 5.3 Quality gate: `pnpm --filter backend build && pnpm --filter backend lint --max-warnings 0`.

## 6. Backend Integration Tests — Scenario Coverage

_Files: new Vitest + Supertest suites under `backend/src/routes/`. Ref: `openspec/changes/ab-1004-note-management/specs/note-management/spec.md`. Depends on: 4, 5._
**Candidate for subagent delegation (>45 min) — recommend the `test-writer` agent, one uniquely named test per scenario below, no application source code changes.**

- [x] 6.1 `notes.create.test.ts` — the 3 scenarios under _Create Note_: authenticated user creates a note with valid content; created note is associated with its creator; unauthenticated note creation is rejected.
- [x] 6.2 `notes.read.test.ts` — the 3 scenarios under _Read Note_: user reads their own active note; user cannot read another user's note; soft-deleted note is not returned via standard read.
- [x] 6.3 `notes.update.test.ts` — the 3 scenarios under _Update Note_: user updates their own active note; user cannot update another user's note; soft-deleted note cannot be updated.
- [x] 6.4 `notes.delete.test.ts` — the 4 scenarios under _Soft Delete Note_: user soft-deletes their own active note; soft-deleted note excluded from active list; soft-deleted note data retained during recovery window; user cannot delete another user's note.
- [x] 6.5 `notes.restore.test.ts` — the 3 scenarios under _Restore Soft-Deleted Note_: user restores their own soft-deleted note within the recovery window; user cannot restore another user's soft-deleted note; purged note cannot be restored.
- [x] 6.6 `notes.purge.test.ts` — the 3 scenarios under _Automatic Note Purge_: note soft-deleted >30 days is permanently purged; restoring a permanently purged note fails; public share link for a purged note no longer grants access (invokes `purgeExpiredNotes()` directly, not a real cron tick). The share-link scenario seeds a `ShareLink` row directly via Prisma (no share-link endpoint exists until AB-1008) and asserts the cascade removes it once the parent note is purged — a DB-level cascade-behavior check only, no sharing endpoints added.
- [x] 6.7 `notes.rateLimit.test.ts` — confirms `/api/notes` is covered by the existing global standard-authenticated-API limiter, rejecting the 1001st request with `429 RATE_LIMIT_EXCEEDED` (NFR-008). **Discovered and fixed a real pre-existing bug while writing this test**: the global limiter in `app.ts` (from AB-1002) had no custom `message` option, so on trip it returned `express-rate-limit`'s default body instead of the project's standard `{ code, message }` shape used by every other limiter — non-compliant with AGENTS.md §8. Fixed by adding `message: { code: "RATE_LIMIT_EXCEEDED", message: "..." }` to the existing `rateLimit()` call in `app.ts`, matching the pattern already used in `authRateLimiters.ts`.
- [x] 6.8 Confirmed every one of the 19 scenarios in `specs/note-management/spec.md` maps to exactly one uniquely named test, one-to-one, no gaps. Note: "purged note cannot be restored" legitimately appears as two separate tests (one in `notes.restore.test.ts`, one in `notes.purge.test.ts`) because the FRS itself lists this as separate acceptance criteria under both FR-NOTE-005 and FR-NOTE-009 — this is correct duplication inherited from the FRS, not a redundant test to remove.
- [x] 6.9 Quality gate: `pnpm --filter backend test` — 24 files / 100 tests, all passing. Coverage (`vitest run --coverage`): overall 93.88% statements / 80.89% branches; new-code files — `notes.ts` 80%, `noteService.ts` 96.55%, `tiptapText.ts` 91.66%, `purgeNotes.ts` 100%, `logger.ts` 100% (the latter two are omitted from the default text-table report because Istanbul's text reporter hides fully-covered files — confirmed via a one-off `coverage-summary.json` reporter run). All comfortably meet the 80% minimum (AGENTS.md §10).

## 7. Final Verification

_Depends on: 1–6 all complete._

- [x] 7.1 Ran the full quality-gate sequence from the repo root in order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`. All pass across all workspaces: shared 3 files/26 tests, backend 24 files/100 tests, frontend 1 unit test + 1 Playwright e2e smoke test.
- [x] 7.2 Manually smoke tested against a live `pnpm --filter backend dev` server on the real `notes_dev` database (not the test DB): happy path (create → list → get → update → soft delete → restore, verifying the `{data,meta}` envelope including its zero-result shape live) and every defined error scenario (unauthenticated create → 401; cross-user read/update/delete/restore → 403, confirming ownership checks win over lifecycle-state checks per design.md §2; update/delete of an already soft-deleted note → 404). All matched expected status codes and bodies exactly.
- [x] 7.3 Manually backdated a note's `deletedAt` to 31 days ago via a throwaway script invoking the real compiled `purgeExpiredNotes()` against the dev DB: purged count was 1, the Pino log line fired (`purgedCount:1, "Purged expired soft-deleted notes"`), the row was confirmed gone via a follow-up Prisma query, and a subsequent restore attempt on that id returned 404 via the live API.
