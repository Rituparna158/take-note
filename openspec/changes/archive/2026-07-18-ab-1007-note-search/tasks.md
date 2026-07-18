## 1. Database & Prisma

- [x] 1.1 Scaffold the migration with `npx prisma migrate dev --create-only --name add_note_search_vector`, then hand-edit `backend/prisma/migrations/<timestamp>_add_note_search_vector/migration.sql` to add a `searchVector` `tsvector` column on `Note`, trigger-maintained (via `tsvector_update_trigger`) from `title` + `"bodyText"`, plus a GIN index on it — per design §1 (revised from `GENERATED ALWAYS ... STORED` after a Prisma migrate-drift blocker; see design.md). (Files: new migration folder.)
- [x] 1.2 Add `searchVector Unsupported("tsvector")?` to the `Note` model in `backend/prisma/schema.prisma`, then run `npx prisma generate`. (File: `backend/prisma/schema.prisma`.)
- [x] 1.3 Apply the migration to both `notes_dev` and `notes_test` (`DATABASE_URL` and `TEST_DATABASE_URL`), per the dual-database migration convention (SDS §2.2). Confirmed `\d "Note"` shows the trigger-maintained column and GIN index on both databases; `prisma migrate status` reports no drift.

## 2. Shared DTOs (`packages/shared`)

- [x] 2.1 Add `packages/shared/src/search/schemas.ts`: `searchQuerySchema` (trimmed `q` with min-length-1, coerced `page`/`limit` with the same defaults as `listNotesQuerySchema`), `noteSearchResultSchema` (`noteResponseSchema.extend({ highlight: z.string() })`), and `searchResponseSchema` (`{ data: noteSearchResultSchema[], meta: noteListMetaSchema }`) — per design §3. Export the new module from `packages/shared/src/index.ts`.
- [x] 2.2 Add `packages/shared/src/search/schemas.test.ts` covering: valid query parses with defaults applied; missing `q` is rejected; whitespace-only `q` is rejected; a valid search response parses correctly.
- [x] 2.3 Quality gate: `pnpm --filter shared build`, `pnpm --filter shared lint --max-warnings 0`, `pnpm --filter shared test`. All passed (70 tests).

## 3. Backend Service Layer

- [x] 3.1 Implement `backend/src/services/searchService.ts` — `searchNotes(userId, query)`: parameterized raw SQL (via `Prisma.sql`, never string-concatenated) scoped to `userId` + `deletedAt IS NULL`, matching against `searchVector` via `plainto_tsquery`, `ts_headline` over `"bodyText"` only for the `highlight` field, ordered by `ts_rank(...) DESC`, paginated with `LIMIT`/`OFFSET`; a parallel raw `COUNT(*)` query (same `WHERE` clause) for `meta.totalCount`; a batched `prisma.noteTag.findMany({ where: { noteId: { in: matchedIds } }, include: { tag: true } })` merged back onto results by `noteId` for the `tags` field. Maps to design §2, FR-SEARCH-001, FR-SEARCH-002. _(Implemented directly per project convention.)_
- [x] 3.2 Implement `backend/src/routes/search.ts` — `searchRouter` with `authenticateToken` applied (mirroring `notesRouter`/`tagsRouter`), `GET /` parsing `req.query` with `searchQuerySchema.safeParse`, returning `400 VALIDATION_ERROR` (via the existing `zodIssuesToFields` helper) on failure, otherwise calling `searchNotes` and returning `200` with the `searchResponseSchema`-shaped body.
- [x] 3.3 Mount `searchRouter` at `/api/search` in `backend/src/app.ts`, alongside the existing `authRouter`/`notesRouter`/`tagsRouter` mounts. No new rate limiter — confirmed the existing global 1000/15min limiter (registered before route mounting) already covers `/api/search`.
- [x] 3.4 Quality gate: `pnpm --filter backend build`, `pnpm --filter backend lint --max-warnings 0`. Both passed (one lint error fixed: unnecessary double type assertion in `searchService.ts`).

## 4. Backend Integration Tests

Each test name below corresponds 1:1 to an acceptance-criteria scenario in `docs/FRS.md` §6 / the `note-search` delta spec (NFR-003).

- [x] 4.1 `backend/src/routes/search.list.test.ts` — FR-SEARCH-001 scenarios: "Search keyword matches a note title", "Search keyword matches note content", "Matching note belongs to another user", "Matching note is soft-deleted", "Search returns more results than one page".
- [x] 4.2 `backend/src/routes/search.highlight.test.ts` — FR-SEARCH-002 scenarios: "Keyword matches searchable note text", "User views search results", "Another user's note contains the keyword".
- [x] 4.3 `backend/src/routes/search.validation.test.ts` — "Search request is missing a keyword" (missing and whitespace-only `q` → `400 VALIDATION_ERROR`) and the unauthenticated-request case (`401 UNAUTHORIZED`).
- [x] 4.4 `backend/src/routes/search.rateLimit.test.ts` — confirms `/api/search` is covered by the existing global authenticated-API rate limiter, mirroring `notes.rateLimit.test.ts`/`tags.rateLimit.test.ts`.
- [x] 4.5 Quality gate: `pnpm --filter backend test`; confirm new code meets the ≥80% coverage requirement. Full suite: 34 files / 155 tests passed (added a tags-in-search-results test after the coverage report flagged the tag-merge loop as untested). Overall coverage: 94.27% statements / 80.27% branches / 98.97% functions / 94.2% lines — all above the 80% threshold.

## 5. Repo-Wide Verification & Smoke Test

- [x] 5.1 Run the full quality-gate sequence at the repo root in order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`. All passed: shared (70 tests), backend (155 tests), frontend (1 test + e2e smoke).
- [x] 5.2 Manually smoke tested the happy path against a local dev server (port 3001, to avoid an unrelated container already on 3000): created notes with distinct title/body keywords, confirmed title-match and content-match results, `<mark>` highlight markup, tags on results (via `search.list.test.ts`'s automated coverage), and pagination across two pages (`totalCount: 3, limit: 2` → page 1 and page 2 both returned correct `meta`).
- [x] 5.3 Manually smoke tested defined error scenarios: missing `q` → `400 VALIDATION_ERROR`; whitespace-only `q` → `400`; unauthenticated request → `401`; another user's note containing the same keyword never appeared in the owner's results; a soft-deleted note disappeared from search results immediately after deletion.
