## 1. Database Schema (design.md §5, Migration Plan)

- [x] 1.1 Add `@@index([noteId])` and `@@index([savedAt])` to the `NoteVersion` model in `backend/prisma/schema.prisma`
- [x] 1.2 Run `npx prisma migrate dev` to generate and apply the additive index-only migration to both `notes_dev` and `notes_test` (ask for explicit `[y/n]` first, per the permission model)
- [x] 1.3 Run `npx prisma generate` to regenerate the Prisma Client

## 2. Shared DTOs (design.md §6)

- [x] 2.1 Add `noteVersionListItemSchema` (`id`, `version`, `title`, `savedAt`), `noteVersionDetailSchema` (adds `content`), and `restoreVersionResponseSchema` (`id`, `title`, `content`, `version`) to `packages/shared/src/notes/schemas.ts`
- [x] 2.2 Export the new schemas and their inferred types from `packages/shared/src/index.ts`
- [x] 2.3 Add/extend unit tests in `packages/shared/src/notes/schemas.test.ts` for the three new schemas (valid/invalid payload cases)

## 3. Version Service (design.md §2, §3, §7)

- [x] 3.1 Create `backend/src/services/versionService.ts` with a `computeNextVersion(tx, noteId)` helper using `aggregate({ _max: { version: true } })`
- [x] 3.2 Implement change-detection logic comparing `existing.title`/`existing.content` against incoming values using `util.isDeepStrictEqual` for content (per design.md §2)
- [x] 3.3 Implement `listVersions(userId, noteId)` — calls `findOwnedNoteOrThrow(userId, noteId, "active")`, returns versions ordered oldest-to-newest as `noteVersionListItemSchema[]`
- [x] 3.4 Implement `getVersionOrThrow(userId, noteId, versionId)` — reuses ownership/active check, throws `404 NOT_FOUND` if the version doesn't exist or doesn't belong to the note (covers purged versions), returns `noteVersionDetailSchema`
- [x] 3.5 Implement `restoreVersion(userId, noteId, versionId)` — reuses ownership/active check, applies the target version's title/content to the `Note` row, re-extracts `bodyText` via the existing `extractPlainText`, and creates a new `NoteVersion` snapshot at the next computed version number, all inside one `$transaction`; permits restoring a version identical to current state (no equality guard)

## 4. Modify Note Service (design.md §1)

- [x] 4.1 Update `noteService.createNote` to create the initial `NoteVersion` (`version: 1`) via a nested `versions: { create: { ... } }` write on `prisma.note.create`
- [x] 4.2 Update `noteService.updateNote` to consolidate tag replacement, the note update, and a conditional version snapshot (using the change-detection logic from 3.2 and `computeNextVersion` from 3.1) into a single `$transaction`, so all three commit atomically or none do

## 5. Version Routes (design.md §4)

- [x] 5.1 Create `backend/src/routes/versions.ts` exporting `noteVersionsRouter = Router({ mergeParams: true })` with `GET /`, `GET /:versionId`, and `POST /:versionId/restore`, each behind `authenticateToken`, delegating to `versionService`
- [x] 5.2 Mount `noteVersionsRouter` in `backend/src/app.ts` at `app.use("/api/notes/:id/versions", noteVersionsRouter)`, positioned before `app.use("/api/notes", notesRouter)` (mirrors the existing `noteShareRouter` mount)

## 6. Version Purge Job (design.md §8)

- [x] 6.1 Create `backend/src/jobs/purgeVersions.ts` exporting `purgeExpiredVersions()`, mirroring `purgeNotes.ts`: 90-day cutoff, `prisma.noteVersion.deleteMany({ where: { savedAt: { lte: cutoff } } })`, logs purged count
- [x] 6.2 Schedule `purgeExpiredVersions` in `backend/src/server.ts` alongside the existing `purgeExpiredNotes` schedule, both reading `PURGE_CRON_SCHEDULE` independently

## 7. Automated Tests

_Note: per standing project preference, these are implemented directly during `/implement` rather than delegated to a test-writer subagent, even though the combined scope below is a reasonable subagent-delegation candidate by size (~6 new/modified test files)._

- [x] 7.1 Extend `backend/src/routes/notes.create.test.ts` — scenario: creating a note saves an initial version snapshot (version 1) with the created title/content
- [x] 7.2 Extend `backend/src/routes/notes.update.test.ts` — scenarios: title/content change saves a new incremented version snapshot; tag-only change saves no new version snapshot
- [x] 7.3 Create `backend/src/routes/versions.list.test.ts` — owner sees versions oldest-to-newest; non-owner gets 403; missing/soft-deleted/purged note gets 404
- [x] 7.4 Create `backend/src/routes/versions.view.test.ts` — owner views a version's full content; current note unchanged after view; non-owner gets 403; purged version or missing note gets 404
- [x] 7.5 Create `backend/src/routes/versions.restore.test.ts` — restore applies title/content and increments version; existing history (including the restored-from version) remains available; restoring a version identical to current state succeeds and adds a new snapshot; non-owner gets 403; soft-deleted note gets 404
- [x] 7.6 Create `backend/src/routes/notes.versionPurge.test.ts` (mirrors `notes.purge.test.ts`) — snapshots older than 90 days are purged; the note itself is untouched even if all its snapshots are purged; a purged version can no longer be viewed or restored

## 8. Quality Gates & Manual Smoke Test

- [x] 8.1 Run `pnpm build` — 0 errors, 0 warnings
- [x] 8.2 Run `pnpm lint --max-warnings 0` — 0 warnings
- [x] 8.3 Run `pnpm test` — all unit/integration tests pass
- [x] 8.4 Manual smoke test: create a note (confirm version 1 saved) → edit title/content (confirm version 2 saved) → edit tags only (confirm no new version) → list versions → view a historical version → restore it (confirm current note updates, history preserved, no-op restore works) → soft-delete the note and confirm all three version endpoints return 404 → restore the note and confirm version access returns

---

**Delegation & parallelization notes:**

- No task in this checklist is individually estimated above 45 minutes; Section 7 (Automated Tests) is the largest single chunk of work by file count and is the one candidate that could warrant subagent delegation by size, but per standing project preference (recorded from prior sessions) it is implemented directly rather than delegated to the `test-writer` subagent.
- No Git worktree parallelization is used for this ticket: it is backend-only, and Sections 1–6 form a strict dependency chain (schema → shared DTOs → service → routes/job → tests) rather than independent parallel tracks.
