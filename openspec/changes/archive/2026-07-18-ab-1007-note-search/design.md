## Context

`Note.bodyText` already stores the extracted plain-text representation of each note's TipTap content (added in AB-1004, populated in `createNote`/`updateNote` via `extractPlainText`). No search index exists yet — AB-1007 adds the PostgreSQL full-text search infrastructure and the `GET /api/search` endpoint described in SDS §3.4 and §4, scoped strictly to the `note-search` capability approved in the proposal. This is a backend-only ticket; the search UI (AB-1013) is out of scope.

## Goals / Non-Goals

**Goals:**

- Implement `GET /api/search` per SDS §3.4.1, returning paginated, keyword-highlighted matches across the caller's own active notes' `title` and `bodyText`.
- Add the generated `tsvector` column + GIN index on `Note` described in SDS §6.1, deployed as a raw-SQL Prisma migration applied to both `notes_dev` and `notes_test` (SDS §2.2, §7).
- Reuse existing DTO/service conventions (Zod schemas in `packages/shared`, thin routers, service-layer Prisma access) established by `notesRouter`/`noteService` and `tagsRouter`/`tagService`.

**Non-Goals:**

- No frontend work (AB-1013).
- No new rate limiter — `/api/search` is already covered by the existing global 1000/15min authenticated-API limiter registered in `app.ts` before routes are mounted.
- No changes to `note-management` or `tag-management` requirements or endpoints.
- No fuzzy/typo-tolerant matching, ranking configuration, or search-analytics beyond what SDS §4 specifies.

## Decisions

### 1. Database: trigger-maintained `tsvector` column + GIN index

Add a `searchVector` column to `Note`, kept in sync via a `BEFORE INSERT/UPDATE` trigger (using PostgreSQL's built-in `tsvector_update_trigger()` function against `title` and `"bodyText"`), backed by a GIN index. This is deployed via a raw-SQL `prisma migrate dev --create-only` migration (following the same pattern already used for `20260718090622_add_tag_lower_name_index`), applied to both `DATABASE_URL` and `TEST_DATABASE_URL` per the dual-database migration convention.

In `schema.prisma`, the column is declared as `searchVector Unsupported("tsvector")?` on `Note` — Prisma cannot map `tsvector` to a native type, so the field is intentionally unselectable/unfilterable through the normal Prisma Client API. The actual search query always goes through `prisma.$queryRaw`.

_Originally attempted_: a `GENERATED ALWAYS ... STORED` column (matching SDS §6.1's literal "generated `tsvector` column" wording), which is the standard PostgreSQL full-text-search pattern. This was reverted after implementation surfaced a concrete blocker: Prisma's `Unsupported("tsvector")` type only models a plain column, so `prisma migrate dev`'s drift detection doesn't understand the `GENERATED` expression and perpetually generates a "fix-up" migration attempting to `DROP DEFAULT`/`DROP INDEX` on it — which fails against Postgres (`column is a generated column`) and blocks every future migration run via this project's `db:migrate` script (used for every subsequent ticket, not just this one). A trigger-maintained column is a plain column from Prisma's point of view, so no drift is ever detected, while still satisfying SDS §6.1's intent (an automatically-derived, always-in-sync search vector).

### 2. Backend: new `search` domain

- `backend/src/routes/search.ts` — new `searchRouter`, mounted at `/api/search` in `app.ts` (alongside the existing `authRouter`/`notesRouter`/`tagsRouter` mounts, after the global rate limiter). Applies `authenticateToken` the same way `notesRouter`/`tagsRouter` do.
- `backend/src/services/searchService.ts` — new `searchNotes(userId, query)` function. Runs the parameterized raw SQL query from SDS §4.1 (via `Prisma.sql`/`prisma.$queryRaw`, never string-concatenated) scoped to `userId` and `deletedAt IS NULL`, ordered by `ts_rank(...) DESC`, with `LIMIT`/`OFFSET` from `page`/`limit`. A second raw `COUNT(*)` query (same `WHERE` clause) produces `totalCount` for the `meta` envelope — mirroring the `Promise.all([findMany, count])` pattern already used in `listActiveNotes`.
- Because the raw query only returns note-core columns + the `highlight` snippet, tags are populated with a second, non-raw lookup: `prisma.noteTag.findMany({ where: { noteId: { in: matchedIds } }, include: { tag: true } })`, grouped by `noteId` and merged into each result in place — avoiding N+1 by batching in one query, consistent with the existing `noteWithTagsInclude` pattern used elsewhere (adapted here since raw SQL can't use Prisma `include`).
- Never import Prisma Client directly into `search.ts`; all query logic stays in `searchService.ts`, per `backend/CLAUDE.md`.

### 3. Shared DTOs (`packages/shared`)

New `packages/shared/src/search/schemas.ts`:

- `searchQuerySchema`: `{ q: string (trim, min 1 after trim), page: coerced int >= 1 default 1, limit: coerced int >= 1 default 10 }` — mirrors `listNotesQuerySchema`'s pagination coercion, but without `sortBy`/`sortOrder`/`tags` (search order is fixed by relevance rank per SDS §4.1).
- `noteSearchResultSchema`: `noteResponseSchema.extend({ highlight: z.string() })` — reuses the existing `noteResponseSchema` (and, transitively, `tagResponseSchema`) rather than redeclaring note/tag fields, per the shared-package no-duplication rule.
- `searchResponseSchema`: `{ data: noteSearchResultSchema[], meta: noteListMetaSchema }` — reuses the existing `noteListMetaSchema` from `notes/schemas.ts` so the envelope matches `GET /api/notes` exactly.

### 4. Highlighting scope

Per the approved proposal, `ts_headline` runs only over `bodyText` (matching SDS §4.1's literal SQL); the `title` field in each result is always the plain, unhighlighted title. No separate `ts_headline` call is added for the title.

### 5. Validation & errors

`searchQuerySchema` parses `req.query` the same way `notesRouter`/`tagsRouter` do (`safeParse` + the existing `zodIssuesToFields` helper), returning `400 VALIDATION_ERROR` when `q` is missing or empty after trimming. `401 UNAUTHORIZED` is handled by `authenticateToken`/`requireUserId`, consistent with every other authenticated router.

## Risks / Trade-offs

- **[Risk]** Hand-written raw SQL bypasses Prisma's type safety and injection protection if built incorrectly. → **Mitigation**: use `Prisma.sql`/tagged-template parameterization exclusively (as SDS §4.1's example already does with `$1`/`$2`/`$3`/`$4`-style placeholders); never interpolate `q` or `userId` into the query string directly.
- **[Risk]** A generated column requires a migration that both adds the column and backfills/regenerates it for existing rows. → **Mitigation**: `GENERATED ALWAYS ... STORED` computes the value automatically for all existing and future rows as part of the `ALTER TABLE ADD COLUMN` migration; no separate backfill step is needed.
- **[Risk]** Fetching tags in a second query after the raw search query could return stale/mismatched ordering. → **Mitigation**: tags are merged back onto results by `noteId` (map lookup), not by array position, so result order from the ranked raw query is preserved regardless of tag-query ordering.

## Migration Plan

1. `npx prisma migrate dev --create-only --name add_note_search_vector` to scaffold the migration file, then hand-edit it to add the generated `searchVector` column and its GIN index (mirroring the `add_tag_lower_name_index` migration's raw-SQL style).
2. Apply the migration to both `notes_dev` and `notes_test` (`DATABASE_URL` and `TEST_DATABASE_URL`), per the project's dual-database migration convention.
3. Run `npx prisma generate` to regenerate the Prisma Client with the new `Unsupported("tsvector")` field recognized.
4. No rollback beyond the standard `prisma migrate` down-migration story is needed — the column is additive and side-effect-free for existing functionality.

## Open Questions

None outstanding — SDS §3.4, §4, and §6.1 fully specify the endpoint contract, SQL mechanics, and indexing strategy; the proposal's clarified decisions (tags populated, title unhighlighted, empty `q` rejected, new `note-search` capability) resolve the remaining ambiguity.
