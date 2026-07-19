## Why

Notes can currently be overwritten with no way to recover an earlier draft — a user who accidentally deletes a paragraph or reverts a rewrite has no path back to what they had before. AB-1009 is next in the mandatory ticket sequence (AB-1001–AB-1008 complete) and delivers automatic version snapshotting on every note save, plus the ability to list, view, and restore historical versions, backed by the `NoteVersion` model already present in the schema since AB-1001.

## What Changes

- **Modify `POST /api/notes`**: on note creation, automatically save an initial `NoteVersion` snapshot (`version = 1`) capturing the created title, content, and extracted `bodyText`. This behavior was deferred from AB-1004 (per its proposal's "later tickets" note) and is delivered here per FR-VER-001.
- **Modify `PUT /api/notes/:id`**: on note update, compare the incoming title/content against the note's current stored state. If either has changed, save a new `NoteVersion` snapshot with the next incremental version number. Tag-only changes (`tagIds` with no title/content change) do NOT create a new version snapshot.
- Add `GET /api/notes/:id/versions` — authenticated, owner-only. Lists historical version snapshots for a note (`id`, `version`, `title`, `savedAt`) ordered oldest-to-newest. Returns `403 FORBIDDEN` for a non-owner and `404 NOT_FOUND` for a missing, soft-deleted, or purged note — soft-deleted notes are treated identically to standard note read/update operations (FR-NOTE-002/003 convention) and become accessible again only once restored.
- Add `GET /api/notes/:id/versions/:versionId` — authenticated, owner-only. Returns the full snapshot (including TipTap JSON `content`) for one historical version. Same ownership/soft-delete/404 rules as above; `404 NOT_FOUND` if the version has been purged or does not belong to the note.
- Add `POST /api/notes/:id/versions/:versionId/restore` — authenticated, owner-only. Applies the target version's title/content to the current `Note` row (re-extracting `bodyText`), and saves a new `NoteVersion` snapshot reflecting this restored state at the next incremental version number. Existing historical snapshots are never deleted or reordered by a restore. Restoring a version whose content is already identical to the note's current live state is permitted and still creates a new snapshot (no special-case equality rejection). Same ownership/soft-delete/404 rules as above.
- Add an automatic daily purge job (`purgeVersions.ts`) using the already-installed `node-cron` dependency (added in AB-1004), reading the existing `PURGE_CRON_SCHEDULE` env var on its own independent schedule invocation, permanently deleting `NoteVersion` rows where `savedAt <= now() - 90 days` (FR-VER-005). This purge applies strictly by snapshot age with no exemption for a note's single newest snapshot — a long-untouched note can end up with zero listed versions while the `Note` row itself remains fully intact, editable, and unaffected. This is independent of, and separate from, the existing `purgeNotes.ts` 30-day soft-delete purge job.
- Add shared Zod schemas/DTOs for the version-list item, the single-version detail response, and the restore-response payload in `packages/shared`.
- No new rate limiter is introduced — the new version endpoints are nested under `/api/notes/:id` and already fall under the existing global "Standard Authenticated API" limiter (1000 req/15min) mounted ahead of `/api/notes/*`.

Explicitly out of scope for this ticket (deferred to later tickets in the mandatory sequence):

- Frontend version-history drawer and restore UI — AB-1015.

## Capabilities

### New Capabilities

- `note-version-history`: Listing, viewing, and restoring historical note version snapshots, plus automatic purging of snapshots older than the configured retention period.

### Modified Capabilities

- `note-management`: The existing "Create Note" and "Update Note" requirements gain the side effect of automatically saving a `NoteVersion` snapshot (initial snapshot on create; incremental snapshot on a title/content-changing update), per FR-VER-001.

## Impact

- **Database**: no schema change — `NoteVersion` already exists from AB-1001's initial migration.
- **Backend (new files)**:
  - `backend/src/routes/versions.ts` — router for `GET /versions`, `GET /versions/:versionId`, `POST /versions/:versionId/restore`, mounted under `/api/notes/:id`.
  - `backend/src/services/versionService.ts` — version-snapshot creation (called from `noteService` on create/update), listing, view, and restore logic, enforcing ownership and soft-delete rules consistent with `noteService`.
  - `backend/src/jobs/purgeVersions.ts` — `node-cron` scheduled purge job for snapshots older than 90 days.
- **Backend (modified files)**:
  - `backend/src/services/noteService.ts` — call into `versionService` to save a snapshot on create and on title/content-changing update.
  - `backend/src/app.ts` — mount the new versions router; start the `purgeVersions` cron job alongside the existing `purgeNotes` job.
- **Shared**: `packages/shared/src/notes/schemas.ts` (or a new `versions/schemas.ts`) — Zod schemas/types for the version list item, version detail, and restore response DTOs; exported from `packages/shared/src/index.ts`.
- **Tests**: new Vitest + Supertest integration suites covering snapshot creation on create/update, list/view/restore ownership and 404/soft-delete rules, no-op restore, and the purge job's 90-day cutoff behavior.

**Requirements covered:** FR-VER-001, FR-VER-002, FR-VER-003, FR-VER-004, FR-VER-005 (ticket AB-1009 per FRS §17/§18); NFR-004 (security), NFR-005 (data isolation).
