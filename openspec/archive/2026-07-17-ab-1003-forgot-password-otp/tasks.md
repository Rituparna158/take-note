## 1. Shared Schemas (`packages/shared`)

- [x] 1.1 Add `forgotPasswordRequestSchema`, `resetPasswordRequestSchema`, and `messageResponseSchema` to `packages/shared/src/auth/schemas.ts` (email + password rules reused from existing register/login schemas; OTP validated as exactly 6 digits)
- [x] 1.2 Export the new schemas and their inferred types from `packages/shared/src/index.ts`
- [x] 1.3 Add unit tests for the new schemas (valid input, malformed email, non-6-digit OTP, short password) in `packages/shared/src/auth/schemas.test.ts`
- [x] 1.4 Run quality gates for the shared workspace: `pnpm --filter shared build` → `pnpm --filter shared lint` → `pnpm --filter shared test`

## 2. OTP Utility (`backend/src/lib`)

- [x] 2.1 Create `backend/src/lib/otp.ts` with `generateOtp()` (crypto-random 6-digit, zero-padded) and `hashOtp()` (SHA-256, matching `refreshTokenService`'s hashing style)
- [x] 2.2 Add `backend/src/lib/otp.test.ts` covering: output is always exactly 6 digits, output is zero-padded when the random value is small, and `hashOtp` is deterministic for the same input

## 3. Repository Layer (`backend/src/services/userRepository.ts`)

- [x] 3.1 Add `setResetOtp(userId, otpHash, expiresAt)` — unconditional update (no single-use invariant to protect on the forgot-password side, per design.md Decision #3)
- [x] 3.2 Add `consumePasswordReset({ email, expectedOtpHash, passwordHash, now })` — atomic conditional `updateMany` per design.md Decision #4; returns `true` only if exactly one row matched and was updated
  - No dedicated repository unit test file, consistent with existing project convention (`userRepository.ts` has no `.test.ts` — it's exercised indirectly through service/route integration tests)

## 4. Password Reset Service (`backend/src/services/passwordResetService.ts`)

- [x] 4.1 Implement `requestPasswordReset(email)`: normalize email, look up user, generate + hash OTP, set 15-minute expiry, persist via `setResetOtp`, `console.log` the plaintext OTP; no-op (but same return) if the user doesn't exist
- [x] 4.2 Implement `resetPassword(email, otp, newPassword)`: normalize email, hash OTP, hash new password, call `consumePasswordReset`; throw `AppError(400, "VALIDATION_ERROR", "Invalid or expired OTP")` if it returns `false`
- [x] 4.3 Add `backend/src/services/passwordResetService.test.ts` (integration-style against `notes_test`, matching `authService.test.ts`'s pattern) covering: OTP generated for eligible account, no-op for non-existent account, successful reset, invalid/expired/reused OTP rejection

## 5. Rate Limiters (`backend/src/middleware/authRateLimiters.ts`)

- [x] 5.1 Add `forgotPasswordLimiter` (3/hour) with a custom `keyGenerator`: normalized email from `req.body.email` when present and a non-empty string, else `ipKeyGenerator(req.ip)` fallback (per design.md Decision #5 / verified `express-rate-limit` docs)
- [x] 5.2 Add `resetPasswordLimiter` (5/minute), default IP-based keying, same `skipInTestEnv` pattern as existing limiters

## 6. Routes & Scenario Tests (`backend/src/routes/auth.ts`)

- [x] 6.1 Add `POST /forgot-password`: `forgotPasswordLimiter` → validate `forgotPasswordRequestSchema` → `passwordResetService.requestPasswordReset` → fixed `200` message
- [x] 6.2 Add `POST /reset-password`: `resetPasswordLimiter` → validate `resetPasswordRequestSchema` → `passwordResetService.resetPassword` → `200` success message

**[Candidate for subagent delegation — 9 named scenario tests plus 1 additional concurrency test across two files, likely >45 min]**

`backend/src/routes/auth.forgotPassword.test.ts` — one uniquely named test per FR-AUTH-005 delta-spec scenario (4 of 9):

- [x] 6.3 Test: _"generates and stores a 15-minute OTP for an eligible account and responds 200 without exposing it in the response body"_ — covers scenario **Password recovery requested for an eligible account**
- [x] 6.4 Test: _"logs the plaintext OTP to the console and never includes it in the HTTP response"_ — covers scenario **Reset notification is logged rather than emailed**. Spy/capture `console.log` output, assert the generated OTP string appears in the logged output, and assert the response body (`{ message }`) contains no OTP-bearing field and does not include the OTP value as a substring.
- [x] 6.5 Test: _"returns the same 200 response for a non-existent email without writing to the database"_ — covers scenario **Password recovery for a non-existent account does not reveal account existence**
- [x] 6.6 Test: _"invalidates a previously issued OTP when a second forgot-password request is made for the same account"_ — covers scenario **A new forgot-password request invalidates a previously issued unused OTP**

`backend/src/routes/auth.resetPassword.test.ts` — one uniquely named test per FR-AUTH-006 delta-spec scenario (5 of 9):

- [x] 6.7 Test: _"resets the password with a valid unexpired OTP"_ — covers scenario **Successful password reset with a valid unexpired OTP**
- [x] 6.8 Test: _"rejects an invalid OTP"_ — covers scenario **Invalid OTP is rejected**
- [x] 6.9 Test: _"rejects an expired OTP"_ — covers scenario **Expired OTP is rejected**
- [x] 6.10 Test: _"rejects a reused OTP"_ — covers scenario **Reusing a previously consumed OTP is rejected**
- [x] 6.11 Test: _"allows login with the new password after a successful reset"_ — covers scenario **New password is usable for subsequent login**

All 9 delta-spec scenarios are now mapped 1:1 to a uniquely named test (tasks 6.3–6.11).

- [x] 6.12 **[Additional design/security test — not a delta-spec scenario]** In `auth.resetPassword.test.ts`, add a concurrency test issuing two simultaneous `POST /reset-password` requests with the same valid OTP and asserting exactly one succeeds (`200`) and the other is rejected (`400 VALIDATION_ERROR`) — validates design.md Decision #4's atomic consumption fix
- [x] 6.13 Extend `backend/src/routes/auth.rateLimit.test.ts` with cases for `forgotPasswordLimiter` (429 after 3 requests/hour for the same email) and `resetPasswordLimiter` (429 after 5 requests/minute)

## 7. Quality Gates & Manual Smoke Test

- [x] 7.1 Run backend quality gates in order: `pnpm --filter backend build` → `pnpm --filter backend lint --max-warnings 0` → `pnpm --filter backend test`
- [x] 7.2 Run root-level quality gates: `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`
- [x] 7.3 Manually smoke test the happy path and defined error scenarios per NFR-003: forgot-password (confirm OTP appears in server console), successful reset + login with new password, invalid/expired/reused OTP rejection, rate-limit triggering on both endpoints
