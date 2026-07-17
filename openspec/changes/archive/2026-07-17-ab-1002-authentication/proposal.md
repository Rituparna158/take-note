## Why

The application currently has no authentication system, so no user can create an account, sign in, or maintain a session. AB-1002 is the next ticket in the mandatory FRS sequence (§18) after AB-1001 (project foundation) and must land before any note, tag, search, or sharing functionality can be built, since every subsequent capability depends on an authenticated `User` identity.

## What Changes

- Add `POST /api/auth/register` — creates a `User` account with a case-insensitively unique email and a securely hashed password (bcrypt, cost factor 10); rejects duplicate emails and invalid input.
- Add `POST /api/auth/login` — authenticates email + password credentials; rejects invalid credentials with a generic error that does not reveal which field was wrong.
- Add `POST /api/auth/logout` — invalidates the current session's refresh capability by deleting the corresponding `RefreshToken` row; idempotent even if the refresh cookie is missing or already invalidated.
- Add `POST /api/auth/refresh` — rotates the refresh token (invalidate-then-reissue) and issues a new short-lived access token.
- Add `authenticateToken` Express middleware that verifies the JWT access token on protected routes and rejects missing/invalid/expired tokens.
- Add rate limiting for the four auth endpoints per SDS §5 (register: 3/hour/IP, login: 5/min/IP, refresh: 20/min/IP, logout: 20/min/IP).
- Add shared Zod schemas/DTOs in `packages/shared` for register/login request bodies and the auth response shape, consumed by both `backend` and (later) `frontend`.
- Add the `User` and `RefreshToken` Prisma models and an initial migration (applied to both `notes_dev` and `notes_test`).

Out of scope for this ticket (deferred to AB-1003 per the mandatory sequence): forgot-password, OTP generation/verification, and password reset.

## Capabilities

### New Capabilities

- `user-authentication`: Registration, login, logout, JWT access-token issuance/verification, and refresh-token rotation for session continuity, per FR-AUTH-001 through FR-AUTH-004.

### Modified Capabilities

(none — no existing capability specs change)

## Impact

- **Database**: New `User` and `RefreshToken` Prisma models and migration; `RefreshToken.userId` cascades from `User`.
- **Backend**: New `backend/src/routes/auth.ts` (or equivalent) Express router mounted at `/api/auth`; new auth service/repository module; new `authenticateToken` middleware wired into the fixed middleware order (after rate limiters, before protected routes); new password-hashing utility (bcrypt).
- **Shared**: New Zod schemas/types for register/login requests and the auth success response in `packages/shared`.
- **Environment**: Introduces reliance on `JWT_SECRET` (already defined in SDS §8 environment config).
- **Testing**: New Vitest + Supertest integration tests covering FR-AUTH-001–004 acceptance criteria against `notes_test`.
