## Why

Registered users have no way to recover their account if they forget their password — AB-1002 delivered register/login/logout/refresh only, explicitly deferring password reset to this ticket. AB-1003 is the next ticket in the mandatory FRS sequence (§18) and must land before notes/tags/search/sharing work begins.

## What Changes

- Add `POST /api/auth/forgot-password` — accepts an email address, and if it matches an existing account, generates a 6-digit numeric OTP, hashes it (SHA-256) into `User.resetOtpHash`, sets `User.resetOtpExpires` to 15 minutes from now, and logs the plaintext OTP to the console (simulated delivery, no real email). Always returns the same `200 OK` message regardless of whether the email exists, to prevent account enumeration.
- Add `POST /api/auth/reset-password` — accepts email, OTP, and a new password; verifies the OTP against the stored hash and expiry, rejects invalid/expired/already-consumed OTPs, hashes the new password (bcrypt, matching the existing `hashPassword` utility), updates `User.passwordHash`, and clears `resetOtpHash`/`resetOtpExpires` so the OTP cannot be reused. Existing sessions (refresh tokens) are left untouched — this ticket introduces no session-revocation behavior.
- Add a `forgotPasswordLimiter` (3 requests/hour, keyed on the normalized/lowercased email from the request body, falling back to IP if no parseable email is present) and a `resetPasswordLimiter` (5 requests/minute, keyed on IP) per SDS §5, following the existing `authRateLimiters.ts` pattern (including `skipInTestEnv`).
- Add shared Zod schemas/DTOs in `packages/shared` for the forgot-password request, reset-password request, and their response shapes, reusing the existing `email` and `password` (min 8) validation rules already established for register/login.
- Invalid/expired/reused OTP on `reset-password` responds `400 Bad Request` with `code: "VALIDATION_ERROR"` (not `UNAUTHORIZED`), since an OTP is a one-time input value, not a session credential — consistent with how `AppError`/`VALIDATION_ERROR` is used elsewhere for rejected request payloads.

No Prisma migration is required: `User.resetOtpHash` and `User.resetOtpExpires` already exist in `schema.prisma` from AB-1001 scaffolding.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `user-authentication`: Adds two new requirements — Forgot Password Request (FR-AUTH-005) and Password Reset Using OTP (FR-AUTH-006) — extending the existing authentication capability with account-recovery behavior.

## Impact

- **Database**: No schema changes; reuses existing `User.resetOtpHash`/`resetOtpExpires` columns.
- **Backend**: New routes on the existing `authRouter` (`backend/src/routes/auth.ts`); new service functions in `authService.ts` (or a new `passwordResetService.ts`) for OTP generation/verification; new rate limiters in `authRateLimiters.ts`; reuses the existing `hashPassword` utility (bcrypt) and a new SHA-256 OTP-hashing helper.
- **Shared**: New Zod schemas/types for forgot-password and reset-password request/response shapes in `packages/shared`.
- **Testing**: New Vitest + Supertest integration tests covering FR-AUTH-005 and FR-AUTH-006 acceptance criteria (OTP generation, expiry, invalid OTP, reuse rejection, successful reset, rate limiting) against `notes_test`.
