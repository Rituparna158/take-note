## 1. Shared Query Schema (`packages/shared`)

- [x] 1.1 Add `listNotesQuerySchema` and its inferred `ListNotesQuery` type to `packages/shared/src/notes/schemas.ts`: `page`/`limit` via `z.coerce.number().int().min(1)` (no upper bound on `limit`, per design.md), `sortBy` as `z.enum(["createdAt", "updatedAt"])` defaulting to `"updatedAt"`, `sortOrder` as `z.enum(["asc", "desc"])` defaulting to `"desc"`, and `tags` as an optional comma-separated string parsed into a `z.uuid()[]`.
- [x] 1.2 Export `listNotesQuerySchema` and `ListNotesQuery` from `packages/shared/src/index.ts`, following the existing barrel-export pattern used for the other notes schemas/types.
- [x] 1.3 Add unit tests in `packages/shared/src/notes/schemas.test.ts` for `listNotesQuerySchema`: defaults applied when params are omitted; valid `page`/`limit`/`sortBy`/`sortOrder`/`tags` accepted; non-numeric/zero/negative `page` or `limit` rejected; unsupported `sortBy`/`sortOrder` values rejected; malformed (non-UUID) entry in `tags` rejected.
- [x] 1.4 Run quality gates for the shared workspace: `pnpm --filter shared build` → `pnpm --filter shared lint --max-warnings 0` → `pnpm --filter shared test`. Do not proceed past a failing gate.

## 2. Backend Service Layer (`backend/src/services/noteService.ts`)

- [x] 2.1 Change `listActiveNotes` to accept `(userId: string, query: ListNotesQuery)` instead of `(userId: string)`.
- [x] 2.2 Build the Prisma `where` clause: `{ userId, deletedAt: null }`, plus (when `query.tags` is present and non-empty) an `AND` array containing one `{ tags: { some: { tagId } } }` entry per requested tag ID, per design.md's AND-semantics decision.
- [x] 2.3 Build `orderBy: { [query.sortBy]: query.sortOrder }`, and `skip`/`take` from `query.page`/`query.limit` (`skip = (page - 1) * limit`, `take = limit`).
- [x] 2.4 Run `prisma.note.findMany` with the above `where`/`orderBy`/`skip`/`take`, and a parallel `prisma.note.count({ where })` (same `where`, no `skip`/`take`) for `totalCount`.
- [x] 2.5 Compute `meta`: `totalCount`, `page: query.page`, `limit: query.limit`, `totalPages: Math.ceil(totalCount / query.limit)` (`0` when `totalCount` is `0`). Confirm a `page` beyond `totalPages` yields `data: []` with accurate `meta` from the overshot `skip`, with no special-case branch.

## 3. Backend Route (`backend/src/routes/notes.ts`)

- [x] 3.1 In the `GET /` handler, parse `req.query` with `listNotesQuerySchema.safeParse`, converting failures to `400 VALIDATION_ERROR` via the existing `zodIssuesToFields` helper (same pattern already used by the create/update handlers).
- [x] 3.2 Pass the parsed, typed query object to `listActiveNotes(userId, query)` and return its result unchanged (`200 OK`).

## 4. Backend Integration Tests (`backend/src/routes/notes.read.test.ts` or a new `notes.list.test.ts`)

- [x] 4.1 Pagination: a user with more active notes than one page's `limit` gets results split across multiple pages (FR-NOTE-006).
- [x] 4.2 Pagination: requesting a specific `page` returns the corresponding slice of notes (FR-NOTE-006).
- [x] 4.3 Pagination: another user's active notes are excluded from the caller's list (FR-NOTE-006).
- [x] 4.4 Sorting: `sortBy=createdAt` orders notes by creation time (FR-NOTE-007).
- [x] 4.5 Sorting: `sortBy=updatedAt` orders notes by last-updated time (FR-NOTE-007).
- [x] 4.6 Sorting: selects ascending order (FR-NOTE-007).
- [x] 4.7 Sorting: selects descending order (FR-NOTE-007).
- [x] 4.8 Tag filtering: filtering by a tag associated with one or more of the user's notes returns only the matching notes (FR-NOTE-008). Seed `Tag`/`NoteTag` rows directly via Prisma in the test (no Tag CRUD endpoint exists until AB-1006).
- [x] 4.9 Tag filtering: filtering by multiple tag IDs returns only notes matching all selected tags (AND semantics) (FR-NOTE-008).
- [x] 4.10 Tag filtering: a filter matching no active notes returns an empty result set (FR-NOTE-008).
- [x] 4.11 Tag filtering: filtered results still page correctly when they span more than one page (FR-NOTE-008).
- [x] 4.12 Validation (Technical Test): non-numeric/zero/negative `page` or `limit`, an unsupported `sortBy`/`sortOrder` value, and a malformed (non-UUID) `tags` entry each return `400 VALIDATION_ERROR` (SDS §3.2.2; design.md).
- [x] 4.13 Edge case (Technical Test): a `page` beyond the last available page returns `200 OK` with an empty `data` array and accurate `meta` (design.md).

## 5. Final Quality Gates & Manual Smoke Test

- [x] 5.1 Run the full monorepo quality gate sequence in order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`. Do not proceed past a failing gate.
- [x] 5.2 Manually smoke test the happy path (paginate, sort by each field/direction, filter by a single tag and by multiple tags) and the defined error scenarios (invalid `page`/`limit`/`sortBy`/`sortOrder`/`tags`) against a running backend instance, per NFR-003.
