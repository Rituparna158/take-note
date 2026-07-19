## 1. Preflight

- [x] 1.1 Confirm no Prisma migration is needed: verify `backend/prisma/schema.prisma`'s `ShareLink` model and `Note.shareLinks` relation already match SDS §2 exactly, and that `notes_dev`/`notes_test` already have the `ShareLink` table (via the existing `20260716181012_init` migration). Per design "Migration Plan" — no schema/migration work in this ticket. Confirmed via `prisma migrate status` ("Database schema is up to date!") and the pre-existing `notes.purge.test.ts`, which already exercises `prisma.shareLink.create()` against `notes_test`.

## 2. Shared DTOs (`packages/shared`)

- [x] 2.1 Add `packages/shared/src/share/schemas.ts`: `generateShareLinkRequestSchema` (`expiresInDays: z.number().int().min(1).max(30).optional()`), `shareLinkResponseSchema` (`{ shareLink: string, expiresAt: iso datetime, viewCount: nonnegative int, revoked: boolean }`), `publicShareResponseSchema` (`{ title: string, content: tiptapDocumentSchema, updatedAt: iso datetime }`, reusing `tiptapDocumentSchema` from `notes/schemas.ts`) — per design §6. (File: `packages/shared/src/share/schemas.ts`.)
- [x] 2.2 Export the new schemas/types from `packages/shared/src/index.ts`, following the existing per-domain export block pattern (`auth`/`notes`/`tags`/`search`).
- [x] 2.3 Add `packages/shared/src/share/schemas.test.ts` covering: `expiresInDays` omitted parses fine; `expiresInDays` within 1–30 parses; `expiresInDays` of 0, 31, and non-integer are rejected; a valid share-link response parses; a valid public-share response parses.
- [x] 2.4 Quality gate: `pnpm --filter shared build`, `pnpm --filter shared lint --max-warnings 0`, `pnpm --filter shared test`. All passed (77 tests).

## 3. Backend Service Layer

- [x] 3.1 Export `findOwnedNoteOrThrow` from `backend/src/services/noteService.ts` (behavior unchanged) so it can be reused by the new share service, per design §2.
- [x] 3.2 Implement `backend/src/services/shareService.ts`: local `hashToken()` (SHA-256, matching the `refreshTokenService`/`passwordResetService` pattern); `generateShareLink(userId, noteId, input)` — calls `findOwnedNoteOrThrow(userId, noteId, "active")`, then in one `prisma.$transaction` revokes any existing active `ShareLink` for the note and creates a new one with `randomUUID()`-generated token, `expiresInDays ?? 7` day expiry; returns `{ shareLink: `${WEB_ORIGIN}/share/${token}`, expiresAt, viewCount, revoked }`; `revokeShareLink(userId, noteId)` — ownership check, then `updateMany({ where: { noteId, revoked: false }, data: { revoked: true } })`, throwing `404 NOT_FOUND` if `count === 0`; `viewSharedNote(token)` — hash lookup, `404` if not found, `403` if revoked or expired, `404` if the note is soft-deleted, otherwise atomically increments `viewCount` via `{ increment: 1 }` and returns `{ title, content, updatedAt }`. Maps to design §2–§5, FR-SHARE-001 through FR-SHARE-005.
- [x] 3.3 Implement `backend/src/routes/share.ts`: `noteShareRouter` (`Router({ mergeParams: true })`, `authenticateToken` applied, `POST /` validating body with `generateShareLinkRequestSchema` then calling `generateShareLink`, `DELETE /` calling `revokeShareLink`); `publicShareRouter` (plain `Router()`, no auth, `GET /:token` with the new rate limiter applied, calling `viewSharedNote`). Maps to design §1.
- [x] 3.4 Implement `backend/src/middleware/shareRateLimiters.ts`: `publicShareViewLimiter` (60 requests/minute, keyed on IP + `req.params.token` via `ipKeyGenerator`, `skipInTestEnv()` guard) — per design §7, SDS §5.
- [x] 3.5 Mount both routers in `backend/src/app.ts`: `app.use("/api/notes/:id/share", noteShareRouter)` registered **before** `app.use("/api/notes", notesRouter)`, and `app.use("/api/share", publicShareRouter)` — per design §1's ordering rationale.
- [x] 3.6 Quality gate: `pnpm --filter backend build`, `pnpm --filter backend lint --max-warnings 0`. Both passed.

## 4. Backend Integration Tests

Each test name below corresponds 1:1 to an acceptance-criteria scenario in `docs/FRS.md` §7 / the `note-sharing` delta spec (NFR-003).

- [x] 4.1 `backend/src/routes/share.generate.test.ts` — FR-SHARE-001 scenarios: "Note owner generates a share link", "Note owner generates a share link without specifying expiration", "Note owner attempts to set expiration outside the supported range", "Non-owner attempts to generate a share link" (plus unauthenticated → `401`, note-not-found → `404`).
- [x] 4.2 `backend/src/routes/share.revoke.test.ts` — FR-SHARE-003 scenarios: "Note owner revokes an active share link", "Non-owner attempts to revoke the link" (plus no-active-link → `404`).
- [x] 4.3 `backend/src/routes/share.publicView.test.ts` — FR-SHARE-001 scenarios "Public visitor opens a valid share link" and "Public visitor uses a share link" (assert no mutating route exists at `/api/share/:token`); FR-SHARE-002 scenarios "Public visitor opens a non-expired link" and "Public visitor opens an expired link"; FR-SHARE-003 scenario "Public visitor opens a revoked link"; plus unknown-token → `404`.
- [x] 4.4 `backend/src/routes/share.viewCount.test.ts` — FR-SHARE-004 scenarios: "Valid public share link is successfully viewed", "Multiple successful views occur concurrently" (fire concurrent requests, assert no lost increments), "Expired link is requested", "Revoked link is requested".
- [x] 4.5 `backend/src/routes/share.softDelete.test.ts` — FR-SHARE-005 scenarios: "Active shared note is soft-deleted" and "Public visitor requests a shared soft-deleted note".
- [x] 4.6 `backend/src/routes/share.rateLimit.test.ts` — confirms `GET /api/share/:token` is covered by the new dedicated 60/min IP+token limiter (distinct from the global authenticated-API limiter, since this route has no auth), mirroring the structure of `search.rateLimit.test.ts`.
- [x] 4.7 Quality gate: `pnpm --filter backend test`; confirm new code meets the ≥80% coverage requirement. Full suite: 40 files / 177 tests passed. Coverage: 95.43% statements / 82.08% branches / 99.09% functions / 95.38% lines overall; new code specifically — `shareService.ts` 100%, `routes/share.ts` 96%/100%, `shareRateLimiters.ts` 100%/100% — all above the 80% threshold.

## 5. Repo-Wide Verification & Smoke Test

- [x] 5.1 Run the full quality-gate sequence at the repo root in order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`. All passed: shared (77 tests), backend (177 tests), frontend (1 test + e2e smoke).
- [x] 5.2 Manually smoke tested the happy path against a local dev server (port 3001): generated a share link with the default 7-day expiration and confirmed the returned `expiresAt`; viewed it publicly with no `Authorization` header and confirmed note content plus a view-count increment across two views; regenerated with a custom `expiresInDays: 14` and confirmed the prior link was immediately revoked (`403`); revoked the new link and confirmed it stopped working (`403`).
- [x] 5.3 Manually smoke tested defined error scenarios: `expiresInDays` of 31 and 0 → `400 VALIDATION_ERROR`; unknown token → `404 NOT_FOUND`; unauthenticated generate → `401 UNAUTHORIZED`; non-owner generate and revoke → `403 FORBIDDEN`; soft-deleting the note while a link was active → subsequent public view → `404 NOT_FOUND`.

---

**Delegation / parallelization notes**: All tasks in this ticket are confined to `backend/` and `packages/shared/` and build on each other sequentially (schemas → service → routes → tests), so none are split across separate Git worktrees. Task 3.2 (the `shareService.ts` implementation) was the largest single unit of work; per this project's established working style it was implemented directly in-session rather than delegated to a subagent.
