## 1. Dependencies & Shared Schemas

- [x] 1.1 Add pinned dependencies to `backend/package.json`: `bcryptjs@3.0.3` (dependency), `jsonwebtoken@9.0.3` (dependency), `@types/jsonwebtoken@9.0.10` (devDependency). No `@latest` — exact versions only (AGENTS.md §3).
- [x] 1.2 Run `pnpm install` at the workspace root to update the lockfile.
- [x] 1.3 Add `packages/shared/src/auth/schemas.ts`: `registerRequestSchema`, `loginRequestSchema` (`{ email: z.string().trim().email(), password: z.string().min(8) }`), `authUserSchema`, `authResponseSchema`, and their inferred types (Design D7).
- [x] 1.4 Export the new auth schemas/types from `packages/shared/src/index.ts`.
- [x] 1.5 Add `packages/shared/src/auth/schemas.test.ts` covering valid/invalid email, and password-length boundary (7 vs 8 chars) for the shared schemas.
- [x] 1.6 Quality gate: `pnpm --filter shared build` → `pnpm --filter shared lint --max-warnings 0` → `pnpm --filter shared test`.

## 2. Backend Core Utilities

- [x] 2.1 Add `backend/src/lib/password.ts`: `hashPassword(plain)` / `verifyPassword(plain, hash)` using `bcryptjs`, cost factor 10 (Design D1).
- [x] 2.2 Add `backend/src/lib/password.test.ts`: hashing produces a verifiable hash; correct password verifies true; incorrect password verifies false.
- [x] 2.3 Add `backend/src/lib/jwt.ts`: `signAccessToken(user)` / `verifyAccessToken(token)` using `jsonwebtoken`, HS256, `JWT_SECRET`, `expiresIn: "15m"`, payload `{ sub, email }` (Design D2).
- [x] 2.4 Add `backend/src/lib/jwt.test.ts`: a signed token verifies back to its claims; an expired token throws/rejects; a tampered/invalid token throws/rejects.
- [x] 2.5 Add `backend/src/services/userRepository.ts`: `findByEmail(email)` (case-insensitive lookup) and `create(email, passwordHash)`, isolating Prisma access per `backend/CLAUDE.md`.
- [x] 2.6 Add `backend/src/services/refreshTokenService.ts`: `issue(userId)` (generate `crypto.randomUUID()`, SHA-256 hash, persist with 7-day `expiresAt`), `verifyAndConsume(plainToken)` (hash, look up, reject if missing/expired), `rotate(plainToken)` (delete old + insert new in one `prisma.$transaction`), `revoke(plainToken)` (idempotent delete-if-exists) (Design D3, D9-related risk mitigation).
- [x] 2.7 Add `backend/src/services/refreshTokenService.test.ts`: issue produces a row hashed correctly; verify rejects an expired/missing/unknown token; rotate invalidates the old token and returns a new one; revoke is a no-op (no throw) when the token doesn't exist.
- [x] 2.8 Quality gate: `pnpm --filter backend build` → `pnpm --filter backend lint --max-warnings 0` → `pnpm --filter backend test`.

## 3. Auth Service & Middleware

- [x] 3.1 Add `backend/src/services/authService.ts`: `registerUser`, `loginUser`, `logoutUser`, `refreshSession`, composing `userRepository`, `password`, `jwt`, and `refreshTokenService` (Design D8). Enforce case-insensitive email uniqueness/lookup here (lowercase before compare/store).
- [x] 3.2 Add `backend/src/services/authService.test.ts` covering: duplicate-email rejection, invalid-credential rejection (wrong password and unregistered email use the same generic error), successful register/login token issuance, logout deletes the matching refresh token, logout is a no-op-success when no matching token exists, refresh rotates and rejects an invalidated/expired token.
- [x] 3.3 Add `backend/src/middleware/authenticateToken.ts`: extracts `Authorization: Bearer <token>`, verifies via `jwt.verifyAccessToken`, attaches the user claims to `req`, throws `AppError(401, "UNAUTHORIZED", ...)` on missing/malformed/invalid/expired tokens (Design D5).
- [x] 3.4 Add `backend/src/middleware/authenticateToken.test.ts` covering: valid token passes through; missing header, malformed header, invalid signature, and expired token are all rejected with `401 UNAUTHORIZED`.
- [x] 3.5 Add `backend/src/middleware/authRateLimiters.ts`: `registerLimiter` (3/hour/IP), `loginLimiter` (5/min/IP), `refreshLimiter` (20/min/IP), `logoutLimiter` (20/min/IP), per SDS §5 (Design D6).
- [x] 3.6 Quality gate: `pnpm --filter backend build` → `pnpm --filter backend lint --max-warnings 0` → `pnpm --filter backend test`.

## 4. Routes & Wiring

- [x] 4.1 Add `backend/src/routes/auth.ts`: one `Router` with `POST /register`, `POST /login`, `POST /refresh` (all public, each behind its rate limiter), and `POST /logout` (behind `logoutLimiter` + `authenticateToken`). Each handler validates with the shared Zod schema, calls `authService`, and sets/clears the `refreshToken` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, 7-day `Max-Age` on issue; cleared with `Max-Age=0` on logout) (Design D4, D6, D8).
- [x] 4.2 Mount the router at `/api/auth` in `backend/src/app.ts`, replacing the `AB-1002+` placeholder comment. Confirm `authenticateToken` is not applied globally (Design D5) and the existing middleware order (`helmet` → `cors` → `express.json` → `cookieParser` → `pino-http` → rate limiter → routes → error handler) is preserved.
- [x] 4.3 Confirm `backend/.env.example` documents `JWT_SECRET` (add if missing).
- [x] 4.4 Quality gate: `pnpm --filter backend build` → `pnpm --filter backend lint --max-warnings 0` → `pnpm --filter backend test`.

## 5. Integration Tests (one test per approved scenario)

> Candidate for subagent delegation — writing and debugging the full integration suite below is estimated to exceed 45 minutes.

- [x] 5.1 Add `backend/src/test/resetDatabase.ts`: truncates `User` and `RefreshToken` (`CASCADE`) against `notes_test`, called in `beforeEach` (Design D9).
- [x] 5.2 Add `backend/src/routes/auth.register.test.ts` mapping to spec scenarios: _Successful registration_, _Invalid email format is rejected_, _Duplicate email is rejected_, _Password below minimum length is rejected_.
- [x] 5.3 Add `backend/src/routes/auth.login.test.ts` mapping to spec scenarios: _Successful login_, _Incorrect password is rejected_, _Unregistered email is rejected_.
- [x] 5.4 Add `backend/src/routes/auth.session.test.ts` mapping to spec scenarios: _Valid access token grants protected access_, _Missing or invalid access token is rejected_, _Valid refresh token renews the session_, _Expired or invalid refresh token is rejected_.
- [x] 5.5 Add `backend/src/routes/auth.logout.test.ts` mapping to spec scenarios: _Logout ends the current session_, _Reusing an invalidated refresh token after logout is rejected_, _Logout without a matching refresh token still succeeds_.
- [x] 5.6 Add `backend/src/routes/auth.rateLimit.test.ts` verifying at least one rate limiter (e.g. login) returns `429 RATE_LIMIT_EXCEEDED` once its threshold is exceeded.
- [x] 5.7 Confirm every scenario in `openspec/changes/ab-1002-authentication/specs/user-authentication/spec.md` maps to exactly one uniquely named test (NFR-003 / FR-INFRA-005).
- [x] 5.8 Quality gate: `pnpm --filter backend test -- --coverage` and confirm new code meets the 80% coverage minimum (AGENTS.md §10).

## 6. Final Verification

- [x] 6.1 Manually smoke test the happy path (register → login → access a token-protected test route → refresh → logout) and the defined error scenarios (duplicate email, wrong password, expired/invalid token, reused refresh token) against a running dev server (NFR-003).
- [x] 6.2 Run the full monorepo quality gate in order: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`. Do not proceed if any step fails (AGENTS.md §4.3).
- [x] 6.3 Run `npx commitlint --from HEAD~1` and confirm the Husky `pre-commit` hook passes before committing (CLAUDE.md).

## Parallelization Notes

This ticket is backend-only with a strictly sequential dependency chain (schemas → utilities → services/middleware → routes → tests), so no independent work qualifies for a separate Git worktree under AGENTS.md §4.1/FR-INFRA-006 (worktrees are reserved for genuinely independent parallel tracks, e.g. simultaneous frontend/backend tickets). Section 5 (Integration Tests) is flagged for subagent delegation due to its estimated size, not for worktree parallelization.
