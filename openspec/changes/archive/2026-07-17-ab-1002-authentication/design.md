## Context

AB-1001 already scaffolded the monorepo, including the `User` and `RefreshToken` Prisma models, the initial migration (`20260716181012_init`, applied to both `notes_dev` and `notes_test`), the fixed Express middleware chain in `backend/src/app.ts` (helmet → cors → express.json → cookieParser → pino-http → baseline rate limiter), the shared `AppError` / `errorHandler` (`backend/src/middleware/errorHandler.ts`), and a placeholder comment in `app.ts` marking where AB-1002 wires in `authenticateToken` and the first `/api/<domain>` router. No auth-related code, dependencies, or shared DTOs exist yet. This design implements FR-AUTH-001 through FR-AUTH-004 exactly as contracted in SDS §3.1.1–§3.1.4.

## Goals / Non-Goals

**Goals:**

- Implement `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh` per the exact request/response shapes in SDS §3.1.1–§3.1.4.
- Implement reusable `authenticateToken` middleware for protecting future routes (`/api/notes`, `/api/tags`, etc. in later tickets) and for protecting `logout` in this ticket.
- Implement the four SDS §5 rate limiters for these endpoints.
- Add the shared Zod request/response schemas to `packages/shared`.

**Non-Goals:**

- Forgot-password / OTP reset (`resetOtpHash`, `resetOtpExpires` fields already exist on `User` but are unused until AB-1003).
- Any Prisma schema or migration changes — `User` and `RefreshToken` already exist from AB-1001.
- Any note/tag/search/share/version functionality or their route protection (later tickets), beyond making `authenticateToken` reusable for them.

## Decisions

### D1. Password hashing: `bcryptjs`, cost factor 10

Use `bcryptjs@3.0.3` (pure JavaScript, zero native dependencies, ships its own TypeScript types) rather than `bcrypt` (native bindings). Rationale: avoids node-gyp / native compilation on Windows dev machines and keeps CI simple, at a small throughput cost that is irrelevant at this application's scale. Cost factor 10 per approved proposal decision. A single `backend/src/lib/password.ts` module exports `hashPassword(plain)` / `verifyPassword(plain, hash)`.

### D2. JWT access tokens: `jsonwebtoken`, HS256, `{ sub, email }`

Use `jsonwebtoken@9.0.3` (+ `@types/jsonwebtoken@9.0.10` dev dependency). Sign with `JWT_SECRET` (already defined in SDS §8 env config), algorithm HS256, `expiresIn: "15m"`. Payload: `{ sub: user.id, email: user.email }`. A single `backend/src/lib/jwt.ts` module exports `signAccessToken(user)` / `verifyAccessToken(token)`, returning a typed `{ sub: string; email: string }` claims object or throwing on invalid/expired tokens.

### D3. Refresh tokens: opaque UUID, SHA-256 hash at rest, rotate-on-use

Generate the refresh token as `crypto.randomUUID()` (Node's built-in `node:crypto`, no new dependency). Hash it with SHA-256 (`node:crypto` `createHash`) before persisting as `RefreshToken.tokenHash`; only the plaintext token is ever sent to the client, via the `refreshToken` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=7d`). On `/api/auth/refresh`: hash the incoming cookie value, look up the matching `RefreshToken` row, reject with `401 UNAUTHORIZED` if missing or `expiresAt` has passed, otherwise delete that row and insert a new one in the same request (rotation), matching FR-AUTH-004's requirement that a reused/invalidated refresh credential is rejected. A `backend/src/services/refreshTokenService.ts` module owns issuance, verification, and rotation so the route handlers stay thin per `backend/CLAUDE.md`.

### D4. Logout is idempotent

Per the approved proposal: `POST /api/auth/logout` requires a valid access token (`authenticateToken` applied to this route only, not globally) but does not require a matching refresh token. If the `refreshToken` cookie is present and hashes to an existing row, that row is deleted; if the cookie is missing or doesn't match any row, the handler still clears the cookie and returns `200 { "message": "Logged out successfully" }`. This avoids a client-visible failure for an already-expired or already-rotated-out session.

### D5. `authenticateToken` is applied per-router/per-route, not globally in `app.ts`

The SDS §1.1 middleware list positions `authenticateToken` conceptually between rate limiters and route handlers, but `register`, `login`, and `refresh` must remain publicly reachable (no access token exists yet), and `/api/share/:token` (future ticket) must also stay public. `authenticateToken` is therefore exported from `backend/src/middleware/authenticateToken.ts` and applied explicitly wherever a route needs it — starting with `logout` in this ticket — rather than mounted globally via `app.use()` in `app.ts`. This preserves the documented relative ordering (it still only ever runs after rate limiting and before the protected handler) without blocking the public auth endpoints. Later tickets (AB-1004+) reuse the same exported middleware on their routers.

### D6. Rate limiters live alongside the auth router

Four `express-rate-limit` instances (register: 3/hour/IP, login: 5/min/IP, refresh: 20/min/IP, logout: 20/min/IP — SDS §5), each keyed on `req.ip`, defined in `backend/src/middleware/authRateLimiters.ts` and attached per-route inside `backend/src/routes/auth.ts` (e.g. `router.post("/register", registerLimiter, ...)`), consistent with the "one router per domain" rule in `backend/CLAUDE.md`.

### D7. Shared Zod schemas in `packages/shared`

Add `packages/shared/src/auth/schemas.ts`:

- `registerRequestSchema` / `loginRequestSchema`: `{ email: z.string().trim().email(), password: z.string().min(8) }` (both share one shape per SDS, kept as two named exports so register/login can diverge later without a breaking change).
- `authUserSchema`: `{ id: z.string().uuid(), email: z.string().email() }`.
- `authResponseSchema`: `{ accessToken: z.string(), user: authUserSchema }`.
  All inferred types (`RegisterRequest`, `LoginRequest`, `AuthResponse`, `AuthUser`) are exported via `z.infer`; re-exported from `packages/shared/src/index.ts`. Email case-insensitivity (SDS: "Handled case-insensitively at the application layer") is applied in the backend service layer (lowercase before uniqueness check / storage / lookup), not in the shared schema, since it's an application behavior rather than a wire-format validation rule.

### D8. Service layer boundaries

- `backend/src/services/authService.ts`: `registerUser`, `loginUser`, `logoutUser`, `refreshSession` — orchestrates password hashing, JWT signing, and calls into `refreshTokenService`. Never imports Prisma directly from route files (`backend/CLAUDE.md`).
- `backend/src/services/userRepository.ts`: thin Prisma-backed lookups (`findByEmail`, `create`) so `authService` isn't coupled to Prisma's query API directly.
- `backend/src/routes/auth.ts`: one `Router` mounted at `/api/auth` in `app.ts`; each handler parses/validates with the shared Zod schema, calls the service, sets/clears the `refreshToken` cookie, and returns the response — no business logic in the route file.

### D9. Test isolation helper

No existing DB-reset helper exists in the backend test suite (only a trivial connectivity test exists). Add `backend/src/test/resetDatabase.ts` exporting a `resetDatabase()` helper that truncates `User` and `RefreshToken` (`TRUNCATE ... CASCADE`) against `notes_test`, called in `beforeEach` across the new auth integration test files, per the AGENTS.md testing strategy ("truncates tables beforehand for isolation").

## Risks / Trade-offs

- **[Risk]** `bcryptjs` (pure JS) is slower than native `bcrypt` under heavy concurrent load. → **Mitigation**: acceptable at this project's scale (assessment project, not production traffic); revisit only if a future performance requirement emerges.
- **[Risk]** Per-route (not global) `authenticateToken` placement could let a future ticket accidentally mount a protected router without the middleware. → **Mitigation**: `backend/CLAUDE.md`'s "one router per domain" convention plus the compliance review stage (FR-INFRA-008) catches missing auth checks before merge.
- **[Risk]** Refresh-token rotation (delete-then-insert) is not atomic across two statements. → **Mitigation**: wrap the delete+insert in a single Prisma `$transaction` in `refreshTokenService.rotate()` so a mid-rotation crash can't leave the user with zero valid refresh tokens silently or duplicate active tokens.
- **[Trade-off]** Storing refresh tokens as SHA-256 hashes (not bcrypt) matches the SDS's explicit instruction (§1.1, §3.1.3/3.1.4) — SHA-256 is appropriate here because the refresh token is already a high-entropy random UUID (unlike a user-chosen password), so a slow KDF isn't needed to resist brute-force guessing.

## Migration Plan

No new Prisma migration is required — `User` and `RefreshToken` already exist from AB-1001's `20260716181012_init` migration in both `notes_dev` and `notes_test`. This ticket is additive application code only (new npm dependencies, new backend modules, new shared schemas); no rollback beyond a normal git revert is needed.

## Open Questions

None — all ambiguities identified during `/spec` (password rule, bcrypt cost, JWT claims, logout idempotency, response shape) were resolved and approved in the proposal stage.

## Implementation Addendum

Two additional decisions surfaced during `/implement` that weren't anticipated at design time, both confirmed with the user before implementation:

### D11. Rate limiters skip enforcement under `NODE_ENV=test`

The four SDS §5 limiters (D6) are process-wide singletons; a full integration test run needs more register/login attempts per file than the production thresholds (3/hour, 5/min) allow, causing spurious `429`s that masked the actual scenario being tested (e.g. duplicate-email needs 2 register calls, exceeding the 3/hour limit within one test file). Each limiter now takes a `skip` predicate: `process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_TEST_MODE !== "1"`. Production/dev behavior (`NODE_ENV` unset or `"production"`/`"development"`) is unaffected — thresholds match SDS §5 exactly. `auth.rateLimit.test.ts` sets `RATE_LIMIT_TEST_MODE=1` in `beforeAll`/clears it in `afterAll` to verify the real 429 behavior in isolation; every other test file runs with limiters effectively disabled.

### D12. Backend Vitest config: `fileParallelism: false`

All backend integration tests share one physical `notes_test` Postgres instance and reset it via `TRUNCATE` (D9). Vitest's default parallel file execution let one file's `beforeEach` truncate `User`/`RefreshToken` while another file's request was still in flight, producing intermittent `500`s. `backend/vitest.config.ts` now sets `fileParallelism: false`, so backend test files run sequentially against the shared test database. This applies to all future tickets' backend tests, not just this one — test runs are slower but deterministic.
