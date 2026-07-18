## Context

`GET /api/notes` (AB-1004) currently calls `listActiveNotes(userId)`, which runs `prisma.note.findMany({ where: { userId, deletedAt: null }, orderBy: { updatedAt: "desc" } })` with no `skip`/`take`, and fabricates `meta` (`page: 1, limit: totalCount, totalPages: 1`) from the full in-memory result. FR-NOTE-006/007/008 (SDS §3.2.2) require real pagination, sortable ordering, and multi-tag (AND-semantics) filtering, scoped to the authenticated user's own active notes, ahead of the Notes List frontend (AB-1011). `Tag`/`NoteTag` Prisma models already exist (from AB-1001); no Tag CRUD exists yet (AB-1006), so filtering must work against `NoteTag` rows created directly (e.g. by tests), not via any tag-management endpoint.

## Goals / Non-Goals

**Goals:**

- Replace the fixed `listActiveNotes(userId)` call with a real paginated, sorted, tag-filterable query driven by validated query parameters.
- Validate `page`, `limit`, `sortBy`, `sortOrder`, and `tags` with a single shared Zod schema reused by the route handler, so malformed input is rejected with `400 VALIDATION_ERROR` before hitting the service layer.
- Keep tag filtering correct under AND semantics (a note must carry every requested tag) and correctly isolated per user (a tag ID outside the caller's own `NoteTag` rows simply matches nothing).

**Non-Goals:**

- No `tags` array added to `NoteResponse`/`noteResponseSchema` — deferred to AB-1006 per the approved proposal.
- No Tag CRUD, no Prisma schema/migration changes.
- No changes to `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`, or `POST /api/notes/:id/restore`.
- No changes to rate limiting — `/api/notes/*` keeps the existing global 1000/15min authenticated-API limiter (no new per-route limiter).

## Decisions

**Shared query-validation schema (`packages/shared/src/notes/schemas.ts`).**
Add a `listNotesQuerySchema` built with `z.coerce.number().int()` for `page`/`limit` (query values arrive as strings), `z.enum(["createdAt", "updatedAt"])` for `sortBy` (default `"updatedAt"`), `z.enum(["asc", "desc"])` for `sortOrder` (default `"desc"`), and a `tags` field accepting a comma-separated string that is split and validated as `z.uuid()` per entry. `page` must be a positive integer (`.min(1)`); `limit` must be a positive integer (`.min(1)`) with no upper bound, per the approved proposal. Export the inferred type (`ListNotesQuery`) alongside the schema so the route imports one canonical shape — consistent with `packages/shared/CLAUDE.md`'s no-duplication rule. Reusing Zod (already the project's validation tool) keeps this consistent with every other request/query schema in the codebase; a hand-rolled parser was rejected as it would duplicate validation logic the shared package already owns.

**Route handler (`backend/src/routes/notes.ts`).**
`GET /` parses `req.query` with `listNotesQuerySchema.safeParse`, converting failures into the existing `400 VALIDATION_ERROR` shape via the current `zodIssuesToFields` helper (already used by the create/update handlers) — no new error-formatting code path. On success, the parsed, typed query object is passed straight to `listActiveNotes(userId, query)`. This keeps the route thin per `backend/CLAUDE.md` ("parse/validate input, call a service function, return the response").

**Service layer (`backend/src/services/noteService.ts`).**
Rewrite `listActiveNotes` to accept `(userId: string, query: ListNotesQuery)` and build:

- `where`: `{ userId, deletedAt: null }`, plus — when `tags` is present — one `{ tags: { some: { tagId } } }` entry per requested tag ID inside a Prisma `AND` array. Using `AND` of per-tag `some` clauses (rather than a single `hasEvery`-style clause, which Prisma's relational filters don't expose) is what gives correct "note must have every selected tag" semantics through the `NoteTag` join table. A tag ID not owned by the caller never matches any row in `where: { userId }`, so no separate tag-ownership lookup is needed — ownership falls out of the existing user-scoping clause.
- `orderBy`: `{ [query.sortBy]: query.sortOrder }`.
- `skip`: `(query.page - 1) * query.limit`, `take`: `query.limit`.
- A second `prisma.note.count({ where })` (same `where`, no `skip`/`take`) to compute `totalCount`, from which `totalPages = Math.ceil(totalCount / limit)` (0 when `totalCount` is 0) is derived for `meta`. Running `findMany` and `count` as two queries (rather than one combined query) is the standard Prisma pattern for paginated-list-plus-total-count and keeps the query plan simple; both run against the same indexed `(userId, deletedAt)` predicate (SDS §6.1).
- A page beyond the last available page naturally yields `data: []` from `findMany` (the `skip` overshoots) while `meta` still reports the real `totalCount`/`totalPages` — no special-case branch needed, per the approved proposal's page-overflow behavior.

**No change to `NoteResponse`/`toNoteResponse`.** Only the list endpoint's request-side contract (query params) and internal query construction change; the per-note response shape is untouched, keeping this ticket scoped to FR-NOTE-006/007/008.

## Risks / Trade-offs

- **[Risk]** An unbounded `limit` (per approved proposal: "No cap") lets a caller request an arbitrarily large page in one query. → **Mitigation**: none required by the approved scope; the existing global 1000-requests/15-min authenticated-API rate limiter (SDS §5) remains the abuse control for this endpoint, and a future ticket can add a cap if it proves necessary.
- **[Risk]** `findMany` + `count` is two round-trips instead of one. → **Mitigation**: this is the conventional Prisma pagination pattern used elsewhere in comparable apps; both queries hit the same indexed predicate, so the added cost is small relative to correctness/readability gained over a single hand-rolled raw-SQL count-window query.
- **[Trade-off]** Tag filtering can only be exercised in tests by inserting `NoteTag`/`Tag` rows directly via Prisma (no create-tag endpoint exists until AB-1006). This is expected and consistent with the mandatory ticket sequence — not a defect to work around.

## Migration Plan

No Prisma schema changes, so no new migration is required. Deployment is a standard code-only rollout of the route/service/shared-schema changes; rollback is a plain revert of those files with no data migration to undo.

## Open Questions

None — all ambiguities (tag response field, limit cap, malformed tag ID handling, page-overflow behavior) were resolved during `/spec` and are reflected in the approved proposal.
