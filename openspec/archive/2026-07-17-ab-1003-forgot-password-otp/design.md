## Context

AB-1002 delivered `POST /api/auth/{register,login,logout,refresh}`, backed by `authService.ts`, `userRepository.ts`, `refreshTokenService.ts`, `lib/{jwt,password}.ts`, and `authRateLimiters.ts`, all mounted on the existing `authRouter` (`backend/src/routes/auth.ts`). `User.resetOtpHash`/`resetOtpExpires` already exist in `schema.prisma` from AB-1001 scaffolding but are unused. This ticket wires them up: `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`, per the approved delta spec (`specs/user-authentication/spec.md`, FR-AUTH-005/006).

## Goals / Non-Goals

**Goals:**

- Implement the two endpoints and their full acceptance-criteria/scenario coverage exactly as approved in the delta spec.
- Reuse existing conventions (thin routes → service → repository, `AppError`/`errorHandler`, Zod schemas from `packages/shared`, `skipInTestEnv` rate-limiter pattern) rather than introducing new patterns.

**Non-Goals:**

- No real email delivery (console log only, per FRS §1.3).
- No refresh-token/session revocation on password reset (resolved in proposal clarification — existing sessions stay valid).
- No OTP resend cooldown beyond the SDS §5 rate limiter thresholds.
- No Prisma migration — `resetOtpHash`/`resetOtpExpires` columns already exist.

## Decisions

**1. New `backend/src/lib/otp.ts`** — mirrors the existing `lib/password.ts` / `refreshTokenService.hashToken` style:

- `generateOtp(): string` — `crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits (`String(n).padStart(6, "0")`), so it's cryptographically random, not `Math.random()`.
- `hashOtp(otp: string): string` — `createHash("sha256").update(otp).digest("hex")`, same as `refreshTokenService`'s token hashing.

(No standalone hash-comparison helper — equality is enforced by the database as part of the atomic consumption update in Decision #4, not compared in application code. See Decision #4 for why.)

**2. New `backend/src/services/passwordResetService.ts`** (separate from `authService.ts`, which stays scoped to login/session issuance):

- `requestPasswordReset(email: string): Promise<void>` — normalizes email (same `normalizeEmail` helper style as `authService.ts`), looks up the user; if found, generates+hashes an OTP, sets `resetOtpExpires` to `Date.now() + 15min`, persists via `userRepository.setResetOtp`, and logs the **plaintext** OTP via `console.log` (never returned to the caller). If not found, does nothing. Either way the route returns the same `200` — enumeration protection lives in the route/service boundary, not in the HTTP layer. No concurrency concern here: unlike reset, there's no single-use invariant to protect, so an unconditional write is safe (see Decision #3).
- `resetPassword(email: string, otp: string, newPassword: string): Promise<void>` — normalizes the email, computes `hashOtp(otp)`, hashes the new password via the existing `hashPassword`, then calls `userRepository.consumePasswordReset({ email, expectedOtpHash, passwordHash, now: new Date() })`. That call atomically validates **and** consumes the OTP in a single conditional `UPDATE` (Decision #4) — there is no separate `findByEmail` + in-memory OTP check beforehand; the atomic update **is** the check. If it returns `false` (no row matched: user missing, OTP wrong, OTP expired, or already consumed by a concurrent request), throws `AppError(400, "VALIDATION_ERROR", "Invalid or expired OTP")` — one generic message for all four cases, mirroring the login endpoint's generic-credentials-error pattern so nothing is leaked about which check failed.

**3. `userRepository.ts` additions** (thin Prisma passthroughs, matching existing style):

- `setResetOtp(userId: string, otpHash: string, expiresAt: Date): Promise<void>` — unconditional `prisma.user.update`; safe without a conditional guard because concurrent `forgot-password` calls have no single-use invariant to protect — whichever write lands last simply becomes the active OTP.
- `consumePasswordReset({ email, expectedOtpHash, passwordHash, now }: { email: string; expectedOtpHash: string; passwordHash: string; now: Date }): Promise<boolean>` — atomic conditional update; see Decision #4.

**4. Atomic, race-free OTP consumption** (closes a check-then-act race present in the original draft):

The original draft validated the OTP (lookup + expiry + hash compare) and _then_ wrote the new password + cleared the OTP fields as a separate step. Two concurrent `reset-password` requests carrying the same still-valid OTP would both pass validation before either write landed, so both would succeed — violating FR-AUTH-006 ("A successfully used OTP SHALL NOT be reusable") and letting two different `newPassword` values both appear "accepted," with the DB silently keeping whichever commits last.

Fix: collapse validation and consumption into one atomic conditional `UPDATE`, via Prisma's `updateMany`, keyed directly on email (no separate `findByEmail` needed):

```ts
const result = await prisma.user.updateMany({
  where: {
    email: normalizedEmail,
    resetOtpHash: expectedOtpHash,
    resetOtpExpires: { gt: now },
  },
  data: {
    passwordHash,
    resetOtpHash: null,
    resetOtpExpires: null,
  },
});
return result.count === 1;
```

PostgreSQL evaluates an `UPDATE ... WHERE` as a single atomic operation per row: the row is locked for the statement's duration, and under Prisma's default READ COMMITTED isolation, a second concurrent `UPDATE` targeting the same row waits for the first to commit, then **re-evaluates its own `WHERE` clause against the post-commit row**. Since the winning request already cleared `resetOtpHash` to `null`, the losing request's `WHERE resetOtpHash = expectedOtpHash` no longer matches, so its `updateMany` affects 0 rows and `resetPassword` throws the same generic `VALIDATION_ERROR` — indistinguishable from an invalid/expired OTP, so no information leaks about _why_ the second request lost the race.

No explicit `$transaction` or `SELECT ... FOR UPDATE` is required — a single conditional `UPDATE` is already atomic per row. This mirrors the atomic `UPDATE ... SET "viewCount" = "viewCount" + 1` pattern SDS §3.5.3 already specifies for share-link view counting, so the codebase ends up with one consistent "atomic conditional UPDATE instead of read-then-write" idiom rather than two different concurrency strategies.

**5. Rate limiters** (`authRateLimiters.ts` additions, same `rateLimit({...})` + `skipInTestEnv` shape as existing limiters):

- `forgotPasswordLimiter` — `windowMs: 60*60*1000, limit: 3`, **custom `keyGenerator`**: if `req.body.email` is a non-empty string, key on its normalized (trim+lowercase) form; otherwise fall back to `ipKeyGenerator(req.ip)` (verified against current `express-rate-limit` docs via context7 — the raw `req.ip` fallback is flagged in their own docs as an IPv6-bypass risk, so the helper is required, not optional).
- `resetPasswordLimiter` — `windowMs: 60*1000, limit: 5`, default IP-based keying (no custom `keyGenerator` needed — matches SDS §5 "Keyed On: IP", same as `loginLimiter`).

**6. Routes** (`routes/auth.ts` additions on the existing `authRouter`):

- `POST /forgot-password` → `forgotPasswordLimiter` → validate `forgotPasswordRequestSchema` → `passwordResetService.requestPasswordReset(email)` → always `200 { message: "If this email is registered, a password reset code has been generated." }` (fixed SDS §3.1.5 copy).
- `POST /reset-password` → `resetPasswordLimiter` → validate `resetPasswordRequestSchema` → `passwordResetService.resetPassword(email, otp, newPassword)` → `200 { message: "Password reset successful" }`.

**7. `packages/shared/src/auth/schemas.ts` additions:**

- `forgotPasswordRequestSchema = z.object({ email: z.email().trim() })`
- `resetPasswordRequestSchema = z.object({ email: z.email().trim(), otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"), newPassword: z.string().min(8) })` — reuses the exact `min(8)` rule from register/login, per your earlier confirmation.
- `messageResponseSchema = z.object({ message: z.string() })`, reused for both endpoints' response shape (avoids duplicating an identical schema twice).
- All exported from `packages/shared/src/index.ts` alongside the existing auth exports.

## Risks / Trade-offs

- **Single generic OTP-error message** (doesn't distinguish invalid/expired/reused) → intentional, mirrors the login endpoint's anti-enumeration pattern; mitigates leaking which check failed.
- **Email-keyed rate limiting lets an attacker exhaust a victim's own forgot-password bucket** by submitting their email repeatedly → inherent in the SDS §5-mandated "Keyed On: Email" design, not something this ticket can change; accepted as already baked into the approved spec.
- **No login-style lockout on repeated wrong OTP submissions beyond the 5/min/IP reset-password limiter** → matches FRS/SDS literally; brute-forcing a 6-digit OTP across many IPs within 15 minutes is a theoretical residual risk inherited from the approved spec, not introduced here.

## Migration Plan

None — no Prisma schema changes; `resetOtpHash`/`resetOtpExpires` already exist and are currently unused columns.

## Open Questions

None — all ambiguities were resolved during `/spec` (rate-limit key, session revocation, OTP error code, password rule).
