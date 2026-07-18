## Context

AB-1001–AB-1003 delivered the monorepo foundation, the full Prisma schema (including `Note`, `Tag`, `NoteTag`, `ShareLink`, `NoteVersion` — all created in the initial migration even though only `User`/`RefreshToken` are used so far), and the authentication system (`authenticateToken` middleware, JWT access tokens, refresh-token rotation). AB-1004 is the first ticket to operate on the `Note` model. Per the approved proposal, this ticket delivers create/read/update/soft-delete/restore plus the automatic 30-day purge job — explicitly excluding tag association (AB-1006), pagination/sorting/filtering (AB-1005), and search (AB-1007).

## Goals / Non-Goals

**Goals:**

- Implement `POST /api/notes`, `GET /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`, `POST /api/notes/:id/restore` per SDS §3.2, scoped down to this ticket's requirements.
- Enforce ownership (403) vs. existence (404) semantics per AGENTS.md §8 on every note operation.
- Populate `Note.bodyText` from TipTap JSON `content` on every create/update, in preparation for AB-1007 (no search behavior implemented now).
- Implement the automatic purge job (FR-NOTE-009) as a scheduled background task.
- Add shared Zod schemas/DTOs for note payloads in `packages/shared`.

**Non-Goals:**

- Tag association (`tagIds`) on notes — AB-1006.
- Pagination, sorting, tag-filter query params on `GET /api/notes` — AB-1005.
- Full-text search or highlighting — AB-1007.
- Sharing or version-history endpoints — AB-1008/AB-1009.

## Decisions

### 1. Router / service / repository layering

One router file `backend/src/routes/notes.ts` mounted at `/api/notes`, per backend/CLAUDE.md's "one router per domain" rule. Route handlers stay thin: parse/validate via the shared Zod schema, call `noteService`, return the response. All Prisma access lives in `backend/src/services/noteService.ts` — no direct `PrismaClient` import in the router, consistent with the existing `authService`/`userRepository` split from AB-1002.

**Alternative considered:** a separate repository module (`noteRepository.ts`) distinct from `noteService.ts`, mirroring `userRepository.ts` + `authService.ts`. Rejected for this ticket — the auth split exists because `userRepository` is reused by multiple services (auth, password reset). Note operations have a single consumer (the notes router) for now, so one `noteService` module is sufficient; a repository split can be introduced later if reuse emerges.

### 2. Ownership vs. existence check pattern

Every single-note operation (`GET/PUT/DELETE /api/notes/:id`, restore) fetches the note **by id alone** (not by `id + userId`), then applies this precedence:

1. Note not found in the database at all → `404 NOT_FOUND`.
2. Note found but `userId` does not match the caller → `403 FORBIDDEN`.
3. Note found, owned by the caller, but not in the lifecycle state the operation requires (e.g. `GET`/`PUT`/`DELETE` require `deletedAt IS NULL`; restore requires `deletedAt IS NOT NULL`) → `404 NOT_FOUND`.
4. Otherwise → operation proceeds.

This matches AGENTS.md §8 exactly ("Resource ownership violations return 403 FORBIDDEN; missing/soft-deleted/purged resources return 404 NOT_FOUND") and is the reason step 2 (ownership) must be evaluated before step 3 (lifecycle state) — a soft-deleted note owned by another user must still return 403, not 404, since ownership takes precedence per AGENTS.md.

Restoring a note that exists, is owned by the caller, but is **not** currently soft-deleted (i.e., already active) is not defined by FR-NOTE-005's acceptance criteria. Per the precedence rule above this is treated as "not found in the state required for this operation" → `404 NOT_FOUND`, consistent with how the same rule already handles "update a soft-deleted note" in the opposite direction. This is a technical consistency decision, not a new business rule.

### 3. Note DTOs / validation (`packages/shared/src/notes/schemas.ts`)

- `title`: `z.string().trim().min(1)` — required, non-empty, per FR-NOTE-001. No maximum length or other bound is imposed; none is specified in FRS/SDS.
- `content`: a recursive Zod schema structurally validating a TipTap/ProseMirror JSON node tree (`{ type: string, attrs?: record, content?: Node[], text?: string, marks?: Mark[] }[]` rooted at `{ type: 'doc', content: Node[] }`), confirmed against Tiptap's documented JSON structure (nodes carry `type`/optional `content`/optional `attrs`; only `text`-type nodes carry `text`; marks are inline formatting on text nodes). This validates _shape_, not specific node/mark types, since the set of enabled TipTap extensions isn't fixed by FRS/SDS. No non-emptiness constraint is imposed on content beyond being a structurally valid doc — FR-NOTE-001 does not require non-empty content.
- No `tagIds` field (see proposal).
- Response DTO: `{ id, title, content, createdAt, updatedAt }` — no `tags` field, so as not to imply tag support exists before AB-1006.

### 4. `bodyText` extraction (`backend/src/lib/tiptapText.ts`)

A small recursive function walks the validated content tree and concatenates every `text` node's `text` field (nodes joined with a single space where block boundaries occur, so words from adjacent block nodes don't run together). No external library — this is a straightforward tree walk over an already-validated structure, not a TipTap runtime concern (TipTap itself is an editor library; the backend only stores/reads its JSON output). Runs on every create and every update, before persisting `Note.bodyText`.

### 5. Soft delete / restore

- `DELETE /api/notes/:id` sets `deletedAt = new Date()` via Prisma.
- `POST /api/notes/:id/restore` sets `deletedAt = null`.
- All "active note" queries (`GET` list, `GET :id`, `PUT`, `DELETE`) filter `deletedAt: null`; restore's existence check filters `deletedAt: { not: null }`.

### 6. `GET /api/notes` (minimal list, this ticket only)

Returns all of the caller's active notes (`WHERE userId = ? AND deletedAt IS NULL`), ordered by `updatedAt DESC` (matching the SDS §3.2.2 default sort, since some deterministic order is needed even without configurable sorting). No `page`/`limit`/`sortBy`/`sortOrder`/`tags` query params are accepted in this ticket; AB-1005 will add them.

The response follows the exact `{ data, meta }` envelope SDS §3.2.2 already defines — this ticket does not invent a different temporary contract. Since no pagination logic exists yet, `meta` is populated with default values describing "everything returned in a single page":

```json
{
  "data": [/* all of the caller's active notes */],
  "meta": {
    "totalCount": 3, // actual count of active notes returned
    "page": 1, // fixed — no page query param accepted yet
    "limit": 3, // equal to totalCount — no limit enforced yet
    "totalPages": 1 // fixed — the full result set is always one page
  }
}
```

When AB-1005 adds real pagination, `page`/`limit` become caller-controlled and `totalPages`/`totalCount` reflect the true paginated result set — the envelope shape itself does not change, only the values become dynamic.

### 7. Automatic purge job (`backend/src/jobs/purgeNotes.ts`)

No standalone Pino logger instance exists yet in the codebase — Pino is currently only wired inline via `pinoHttp()` request middleware in `app.ts`, which is scoped to the HTTP request lifecycle. Since the purge job runs on a cron timer outside any request, it has nothing existing to log through. A minimal `backend/src/lib/logger.ts` (a single exported `pino()` instance) is added for this purpose.

Uses `node-cron@4.6.0` (latest stable; verified via Context7 docs — v4 is a from-scratch TypeScript rewrite with bundled type definitions, so **no `@types/node-cron` is added**, since that package's types target the older v2/v3 API and would be incorrect for v4). `cron.schedule(process.env.PURGE_CRON_SCHEDULE, purgeExpiredNotes)` is registered at server startup (`backend/src/server.ts`), guarded by `cron.validate()` on the configured expression (fail-fast at startup with a clear error if `PURGE_CRON_SCHEDULE` is malformed, rather than silently never running).

`purgeExpiredNotes()`:

1. `prisma.note.deleteMany({ where: { deletedAt: { lte: new Date(Date.now() - 30 days) } } })`.
2. Cascade deletion of `NoteTag`, `ShareLink`, `NoteVersion` rows is handled automatically by the existing `onDelete: Cascade` constraints in the schema (SDS §2.1) — no manual cleanup code needed.
3. Logs the purged row count via the existing Pino logger (SDS §2.1: "each logging the count of rows purged").

The job is exported as a plain function separately from its cron registration, so it can be invoked directly and deterministically in integration tests without waiting on a real cron tick.

### 8. Rate limiting

No new rate limiter is added for `/api/notes/*` in this ticket. AB-1002 already registered a global "Standard Authenticated API" limiter (1000 req / 15 min, default IP-based keying, no custom `keyGenerator`) in `backend/src/app.ts`, running before any router is mounted — per its own comment, it is the intended baseline for exactly this SDS §5 requirement, and it applies automatically to `/api/notes/*` the moment the notes router is mounted. Adding a second, notes-specific limiter would be redundant.

The SDS's "Session ID" key (vs. the existing limiter's IP-based key) has no corresponding concept in this schema and is not addressed by this ticket — changing the global limiter's keying strategy is out of scope for AB-1004 (it would mean modifying AB-1002 code for a concern that isn't specific to notes) and is deferred to a future ticket if the discrepancy needs correcting.

**Follow-up fix applied during implementation:** writing the notes rate-limit test (tasks.md §6.7) surfaced that the global limiter had no `message` option, so its `429` response used `express-rate-limit`'s default body instead of the project's standard `{ code, message }` error shape (AGENTS.md §8) — every other limiter in the codebase (`authRateLimiters.ts`) already sets this explicitly. This is a genuine compliance bug, not a notes-specific concern, so it was fixed directly in `app.ts` (a one-line `message` option addition) rather than deferred, since leaving it would mean the global limiter — which covers every route, not just notes — kept returning a non-conformant error body.

### 9. Middleware order

No change to the existing global chain (`helmet → cors → express.json → cookieParser → requestLogger → rate limiters → authenticateToken → routes → errorHandler`, AGENTS.md §5). The notes router and its dedicated rate limiter are registered inside the existing `routes` slot in `app.ts`, after `authenticateToken`.

## Risks / Trade-offs

- **[Risk] `bodyText` extraction logic is written now but has no consumer until AB-1007.** → Mitigation: it's a small, self-contained, independently testable pure function; low cost to write correctly now versus retrofitting it onto every already-created note later.
- **[Risk] Recursive Zod schema for TipTap content could be too permissive (accepts structurally-valid-but-editor-invalid documents) or too strict (rejects a valid extension's node shape).** → Mitigation: validate only the generic node/mark shape documented by TipTap (type/attrs/content/text/marks), not a fixed enum of node types, so any TipTap extension's output validates structurally.
- **[Risk] `node-cron`'s in-process scheduler does not persist across process restarts or coordinate across multiple server instances**, so a purge tick could double-run if horizontally scaled, or be skipped if the process is down at the scheduled time. → Mitigation: out of scope to solve for this ticket (single-instance deployment assumed, consistent with the rest of the project's scope); the job is idempotent (`deleteMany` on an already-purged range is a no-op) so a missed or doubled tick has no correctness impact, only a delay.
- **[Trade-off] Restoring an already-active note returns 404** (Decision 2) rather than a distinct code, because FRS doesn't define this case. → If review disagrees, this is a one-line change confined to `noteService.restoreNote`.

## Migration Plan

No Prisma schema changes are required — `Note` and its indexes already exist from AB-1001's initial migration. Deployment steps:

1. Add `node-cron@4.6.0` to `backend/package.json` (pinned, no `@latest`).
2. Register the purge cron job at server startup in `backend/src/server.ts`.
3. No data backfill needed (no existing note rows in any environment).

No rollback concerns beyond standard git revert — no destructive migration is introduced.

## Open Questions

_None outstanding._ The `GET /api/notes` response envelope (previously flagged) is resolved in Decision 6: follow the exact `{ data, meta }` contract from SDS §3.2.2 now, with default non-paginated metadata values.
