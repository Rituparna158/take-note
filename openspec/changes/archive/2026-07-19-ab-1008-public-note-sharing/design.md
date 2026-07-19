## Context

The `ShareLink` model (and its table) was already scaffolded in AB-1001's initial migration (`20260716181012_init`) from the full schema published in SDS §2 — `schema.prisma` already declares `ShareLink` exactly as SDS §2 specifies, `Note.shareLinks` already exists, and `notes.purge.test.ts` (AB-1004) already exercises `prisma.shareLink.create(...)` to verify cascade-purge behavior. AB-1008 is therefore a **service/route/DTO-only** ticket per the approved proposal (`note-sharing` capability, SDS §3.5, §5) — no Prisma schema or migration work is required. This is a backend-only ticket; the share UI (AB-1014) is out of scope.

## Goals / Non-Goals

**Goals:**

- Implement `POST /api/notes/:id/share`, `DELETE /api/notes/:id/share` (owner-only, authenticated), and `GET /api/share/:token` (public, unauthenticated) exactly per SDS §3.5.
- Reuse existing conventions: thin routers, service-layer Prisma access, Zod schemas in `packages/shared`, the note-ownership/soft-delete check already used by `noteService`.
- Add the one new rate limiter the proposal calls for (`GET /api/share/:token`, 60/min, IP + token), consistent with the `express-rate-limit` patterns already in `authRateLimiters.ts`.

**Non-Goals:**

- No Prisma schema changes or new migration — `ShareLink` already exists in both `notes_dev` and `notes_test`.
- No frontend work (AB-1014).
- No owner-facing `GET /api/notes/:id/share` status endpoint (per the approved proposal's clarified scope).
- No new rate limiter for the owner-facing POST/DELETE routes — already covered by the existing global "Standard Authenticated API" limiter registered in `app.ts` (`/api/notes/*`).
- No changes to `note-management`, `tag-management`, or `note-search` requirements or endpoints.

## Decisions

### 1. New `share` domain: `routes/share.ts` + `services/shareService.ts`

Following `backend/CLAUDE.md`'s "one router per domain" rule, `share` gets its own route file and service file, distinct from `notes`. Because SDS §3.5 defines two structurally different mount points (an authenticated sub-resource of a note, and a standalone public resource), `routes/share.ts` exports **two** `Router` instances rather than one:

- `noteShareRouter` — `Router({ mergeParams: true })`, applies `authenticateToken` internally (same as `notesRouter`/`tagsRouter`/`searchRouter`), defines `POST /` and `DELETE /`. `mergeParams: true` is required so `req.params.id` (the note ID) from the parent mount path is visible inside this router.
- `publicShareRouter` — plain `Router()`, no `authenticateToken`, defines `GET /:token` with the new rate limiter applied per-route.

In `app.ts`, mount order:

```
app.use("/api/notes/:id/share", noteShareRouter);
app.use("/api/notes", notesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/search", searchRouter);
app.use("/api/share", publicShareRouter);
```

The more specific `/api/notes/:id/share` mount is registered before the broader `/api/notes` mount so `noteShareRouter` is always given first chance to match — avoids relying on `notesRouter`'s fall-through behavior for a path shape it doesn't define any route for.

_Alternative considered_: add `/:id/share` directly onto the existing `notesRouter` (mirroring how `/:id/restore` already lives there). Rejected because `backend/CLAUDE.md` explicitly names `share` as its own domain alongside `notes`, `tags`, `search`, `versions` — keeping the route/service files separate now avoids a later split when AB-1009 (`versions`) needs the same nested-domain pattern.

### 2. Reuse `noteService`'s ownership/lifecycle check

`noteService.ts` already has a private `findOwnedNoteOrThrow(userId, noteId, "active" | "softDeleted")` that returns `403 FORBIDDEN` for a non-owner and `404 NOT_FOUND` for a missing/wrong-lifecycle note — exactly the check needed before generating or revoking a share link. It is exported (unchanged behavior) so `shareService.ts` can call `findOwnedNoteOrThrow(userId, noteId, "active")` instead of re-implementing note ownership lookup, per the shared-package/no-duplication spirit applied to service code too (and matching how `noteService` already imports `assertTagsOwnedByUser` from `tagService`).

### 3. Token generation and hashing

`shareService.ts` generates the plaintext token with `randomUUID()` and hashes it with a local `hashToken()` (`createHash("sha256").update(token).digest("hex")`) — the same small helper already duplicated per-file in `refreshTokenService.ts` and `passwordResetService.ts`. Kept as a local duplicate rather than extracted into a shared crypto util, consistent with the existing pattern (no new abstraction introduced for a three-line function used differently enough per call site — TTL units and field names differ across the three services).

### 4. "Always regenerate" via a single transaction

`generateShareLink` revokes any existing active link and creates the new one inside one `prisma.$transaction`, so the "only one active link per note" invariant (SDS §3.5.1) never has a window where two links are simultaneously active:

```ts
await prisma.$transaction(async (tx) => {
  await tx.shareLink.updateMany({ where: { noteId, revoked: false }, data: { revoked: true } });
  return tx.shareLink.create({
    data: { noteId, tokenHash, expiresAt, viewCount: 0, revoked: false },
  });
});
```

`revokeShareLink` uses `updateMany({ where: { noteId, revoked: false }, data: { revoked: true } })` and throws `404 NOT_FOUND` when `result.count === 0` (no active link existed) — matching SDS §3.5.2's error list.

### 5. Public view: atomic increment via Prisma, soft-delete → 404

`viewSharedNote(token)`:

1. Hash the incoming token, `findUnique` by `tokenHash`. Not found → `404 NOT_FOUND` (this single check also covers "note purged," since purging a note cascade-deletes its `ShareLink` rows per SDS §2.1 — there is no separate purged-note case to detect).
2. `revoked === true` → `403 FORBIDDEN`. `expiresAt <= now` → `403 FORBIDDEN`.
3. Load the note by `noteId`. If `deletedAt !== null` (soft-deleted, not yet purged) → `404 NOT_FOUND`, per the approved proposal's clarified decision for FR-SHARE-005.
4. On success, `prisma.shareLink.update({ where: { id }, data: { viewCount: { increment: 1 } } })` — Prisma's `increment` compiles to a single atomic `UPDATE ... SET "viewCount" = "viewCount" + 1`, satisfying FR-SHARE-004's concurrent-view requirement without hand-written raw SQL, per the approved proposal.
5. Return `{ title, content, updatedAt }` from the note — never the `ShareLink` row itself.

### 6. Shared DTOs (`packages/shared/src/share/schemas.ts`)

- `generateShareLinkRequestSchema`: `{ expiresInDays: z.number().int().min(1).max(30).optional() }`.
- `shareLinkResponseSchema`: `{ shareLink: string, expiresAt: iso datetime, viewCount: nonnegative int, revoked: boolean }` — matches the SDS §3.5.1 response shape.
- `publicShareResponseSchema`: `{ title: string, content: tiptapDocumentSchema, updatedAt: iso datetime }` — reuses the existing `tiptapDocumentSchema` from `notes/schemas.ts` rather than redeclaring the TipTap document shape, per the shared-package no-duplication rule.

All three are exported from `packages/shared/src/index.ts` alongside the existing `notes`/`tags`/`search` exports.

### 7. New rate limiter: `middleware/shareRateLimiters.ts`

A new file (not added to `authRateLimiters.ts`, which is auth-domain-scoped) exporting `publicShareViewLimiter`: 60 requests/minute, keyed on `` `${ipKeyGenerator(req.ip)}:${req.params.token}` `` (mirroring the existing `emailOrIpKeyGenerator` pattern), applied only to `publicShareRouter`'s `GET /:token` route. Includes the same `skipInTestEnv()` guard used by every other limiter so integration tests aren't rate-limited by default.

## Risks / Trade-offs

- **[Risk]** A theoretical TOCTOU window exists between reading a `ShareLink`'s `revoked`/`expiresAt` state and the later `viewCount` increment (e.g. a revoke lands in between). → **Mitigation**: not addressed — FR-SHARE-004 only requires that concurrent _successful_ views never lose an increment (satisfied by Prisma's atomic `increment`), not that a revoke racing a view is itself atomic; inventing stricter conditional-update semantics here would go beyond the approved proposal/spec.
- **[Risk]** Mounting `noteShareRouter` at a path pattern (`/api/notes/:id/share`) separate from `notesRouter`'s `/api/notes` mount could misroute if ordering is wrong. → **Mitigation**: the more specific mount is registered first in `app.ts`, and `noteShareRouter` only defines `POST /` and `DELETE /` (no catch-all), so any other `/api/notes/...` path falls through unaffected to `notesRouter` exactly as before.
- **[Risk]** Forgetting `mergeParams: true` on `noteShareRouter` would silently make `req.params.id` `undefined` inside it. → **Mitigation**: called out explicitly above as a required construction detail; covered by an integration test that asserts the generated link is scoped to the correct note.

## Migration Plan

None. `ShareLink` is already present in `schema.prisma` and in both `notes_dev` and `notes_test` via the existing `20260716181012_init` migration. No `prisma migrate dev` or `prisma generate` step is needed for this ticket.

## Open Questions

None outstanding — SDS §3.5 and §5 fully specify the endpoint contracts, token/hash handling, and rate limit; the proposal's clarified decisions (soft-delete → 404, no status-read endpoint, always-regenerate semantics, Prisma atomic increment) resolve the remaining ambiguity.
