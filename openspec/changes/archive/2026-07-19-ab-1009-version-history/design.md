## Context

`NoteVersion` has existed in the Prisma schema since AB-1001, and `Note.versions` is already declared as a relation, but no code path writes to or reads from it yet. AB-1004 explicitly deferred version-snapshot creation on note create/update to this ticket. The existing `noteService.ts` (`createNote`, `updateNote`, `findOwnedNoteOrThrow`) and the `share` domain (`shareService.ts`, `routes/share.ts`, mounted as a note-scoped router ahead of `/api/notes`) are the two closest precedents this design follows.

`findOwnedNoteOrThrow(userId, noteId, "active")` already throws `403 FORBIDDEN` for a non-owner and `404 NOT_FOUND` for a missing, soft-deleted, or purged note. This is exactly the access rule approved for version list/view/restore (soft-deleted notes block version access entirely, per the approved spec), so version endpoints reuse it unchanged rather than re-implementing ownership/lifecycle checks.

## Goals / Non-Goals

**Goals:**

- Automatically snapshot a note's title/content into `NoteVersion` on creation (version 1) and on any update that changes title or content.
- Add `GET /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionId`, `POST /api/notes/:id/versions/:versionId/restore`, all owner-only, reusing existing ownership/soft-delete rules.
- Add a `purgeVersions.ts` cron job deleting `NoteVersion` rows older than 90 days, independent of `purgeNotes.ts`.
- Keep snapshot writes atomic with the note write they accompany.

**Non-Goals:**

- No frontend work (AB-1015).
- No pagination on the version list endpoint (not specified in FRS/SDS; the SDS response example is a flat array).
- No versioning of tag associations — `NoteVersion` has no tag relation in the schema; only title/content/bodyText are snapshotted.
- No changes to `note-sharing` or `note-search` behavior.

## Decisions

### 1. Snapshot creation is atomic with the Note write it accompanies

**Create**: `prisma.note.create` already supports a nested `versions: { create: { ... } }` write against the `Note.versions` relation, so the initial version (hard-coded `version: 1`) is created in the same atomic operation as the note itself — no explicit `$transaction` wrapper needed for create.

**Update**: `updateNote` currently runs tag replacement (`deleteMany` + `createMany`) as one `$transaction`, then a separate `prisma.note.update` call. This design consolidates both into a single `$transaction` that also conditionally creates the new `NoteVersion` row, so a tag change, a note update, and a version snapshot either all commit or none do.

- _Alternative considered_: leave tag replacement and note update as separate calls (current behavior) and add version creation as a third independent call. Rejected — reintroduces the same partial-failure gap FR-VER-001 depends on not having (a saved note without its corresponding snapshot).

### 2. Change detection compares against the current stored row, using deep structural equality

`updateNote` already calls `findOwnedNoteOrThrow` before writing, so the pre-update row is available for comparison. A new snapshot is created when `existing.title !== input.title` OR the parsed JSON content differs structurally from `existing.content`.

- Content equality uses Node's built-in `util.isDeepStrictEqual` (no new dependency) rather than `JSON.stringify` comparison, to avoid false positives/negatives from key-ordering differences in equivalent TipTap documents.
- Tag-only updates (`tagIds` present, title/content unchanged) correctly produce no new version snapshot, per the approved delta spec.

### 3. Next version number is computed via `aggregate(_max)`, not a stored counter

No field tracks "current version count" on `Note` — the only source of truth is `MAX(NoteVersion.version)` for that `noteId`. Each snapshot write (create, update, restore) computes `(await tx.noteVersion.aggregate({ where: { noteId }, _max: { version: true } }))._max.version ?? 0) + 1` inside the same transaction as the write.

- This correctly continues numbering even if older snapshots have been purged (e.g. next version is 6 even if versions 1–4 were purged and only 5 remains) — purge removes rows, not the numbering history.
- _Edge case_: if literally every prior snapshot for a note has been purged (90-day-old, untouched note), `_max.version` is `null` and the next write is numbered starting from 1 again, rather than continuing a now-invisible historical sequence. Accepted — there is no durable record of the true historical count once all snapshots are gone, and FR-VER-005 only guarantees the _note_ survives purging, not version-number continuity.

### 4. Version endpoints reuse `findOwnedNoteOrThrow`, mounted as a note-scoped router ahead of `/api/notes`

A new `backend/src/routes/versions.ts` exports `noteVersionsRouter = Router({ mergeParams: true })`, mounted in `app.ts` as `app.use("/api/notes/:id/versions", noteVersionsRouter)` — positioned before `app.use("/api/notes", notesRouter)`, mirroring the existing `noteShareRouter` mount. Every handler calls `findOwnedNoteOrThrow(userId, noteId, "active")` first, which already implements the approved "block entirely (404) while soft-deleted" rule with no new logic required.

### 5. New Prisma indexes: `@@index([noteId])` and `@@index([savedAt])` on `NoteVersion`

Per your confirmation, add these two indexes via an additive, index-only migration applied to both `notes_dev` and `notes_test` (dual-database migration rule). This keeps `GET /versions` (filtered by `noteId`) and the daily purge job (filtered by `savedAt <= cutoff`) from full-table-scanning `NoteVersion` as it grows, consistent with the existing convention of indexing every FK/filter column (`Note.userId`, `Note.deletedAt`, `ShareLink.noteId`).

### 6. Shared DTOs added to `packages/shared/src/notes/schemas.ts`

Following the existing pattern (share DTOs live in `share/schemas.ts` and import `tiptapDocumentSchema` from `notes/schemas.ts`), version DTOs are added directly to `notes/schemas.ts` since they describe snapshots of the `Note` shape rather than a separate domain:

- `noteVersionListItemSchema`: `{ id, version, title, savedAt }` — matches SDS §3.6.1.
- `noteVersionDetailSchema`: `{ id, version, title, content, savedAt }` — matches SDS §3.6.2 (adds `content`).
- `restoreVersionResponseSchema`: `{ id, title, content, version }` — matches SDS §3.6.3 (note's own `id`, restored `title`/`content`, and the new incremented `version` number).

All exported from `packages/shared/src/index.ts` alongside the existing note exports.

### 7. `versionService.ts` owns all `NoteVersion` reads/writes; `noteService.ts` calls into it

`noteService.createNote`/`updateNote` import a `saveInitialVersionSnapshot` / `maybeSaveVersionSnapshot` helper from the new `versionService.ts` (or inline the nested-create/aggregate logic directly using a shared `computeNextVersion(tx, noteId)` helper — final choice left to implementation, but `NoteVersion` Prisma queries must not appear directly inside `routes/*.ts` or duplicate query logic between `noteService.ts` and `versionService.ts`, per `backend/CLAUDE.md`'s "never import Prisma Client directly into a route file" and service-layer isolation rules).

### 8. `purgeVersions.ts` mirrors `purgeNotes.ts` exactly

Same shape as the existing job: a single exported async function (`purgeExpiredVersions`) computing a 90-day cutoff, calling `prisma.noteVersion.deleteMany({ where: { savedAt: { lte: cutoff } } })`, logging the purged count via the existing `logger`. `server.ts` schedules it with `cron.schedule(purgeCronSchedule, ...)` alongside the existing `purgeExpiredNotes` schedule, both reading the same `PURGE_CRON_SCHEDULE` env var independently (per SDS §2.1 — same schedule string, two independent job invocations, not a shared job).

## Risks / Trade-offs

- **[Risk] Concurrent updates to the same note** could both read the same pre-update row and compute the same next version number before either write commits, if Prisma's default transaction isolation doesn't serialize the two `aggregate` + `create` sequences against each other. → **Mitigation**: not addressed in this ticket — a single note is edited by its single owner, typically from one session/tab at a time, making true concurrent writes to the _same_ note rare (unlike the public share view-count, which genuinely needs atomic-increment protection because many anonymous visitors hit it at once). No unique constraint on `(noteId, version)` is added, keeping the migration scoped to indexes only as confirmed. Revisit if this becomes an observed problem.
- **[Risk] Full version-history loss for stagnant notes** — a note untouched for 90+ days loses all its snapshots, including the one that mirrors its current live state, per the approved "purge strictly by age, no exemption" decision. → **Mitigation**: this is accepted, approved behavior (FR-VER-005 protects the `Note` row only); `GET /versions` simply returns an empty array in this case, which is a valid, already-covered state.
- **[Trade-off] Consolidating `updateNote`'s transaction boundaries** slightly changes existing code structure (tag replacement + note update currently run as separate awaited calls). → Necessary to guarantee FR-VER-001's atomicity; scoped strictly to `updateNote`, no behavior change to the tag-replacement or note-update logic itself, only when they commit relative to each other.

## Migration Plan

1. Add `@@index([noteId])` and `@@index([savedAt])` to the `NoteVersion` model in `backend/prisma/schema.prisma`.
2. Run `npx prisma migrate dev` to generate the migration, applied to both `notes_dev` and `notes_test` (dual-database rule) — will ask for explicit `[y/n]` before running, per the permission model.
3. Run `npx prisma generate` to regenerate the Prisma Client.
4. No data backfill required — `NoteVersion` is currently empty in both databases (no code path has ever written to it).
5. Rollback: the migration is purely additive (two indexes); reverting is a straightforward `prisma migrate resolve` / down-migration dropping the two indexes, with no data-loss risk.

## Open Questions

None outstanding — the soft-delete access rule, purge-exemption policy, no-op restore behavior, and index/migration scope were all resolved during `/spec` and at the start of `/plan`.
