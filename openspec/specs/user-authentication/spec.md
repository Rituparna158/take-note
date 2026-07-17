# user-authentication Specification

## Purpose

TBD - created by syncing change ab-1002-authentication. Update Purpose after archive.

## Requirements

### Requirement: User Registration

The system SHALL allow a user to register using an email address and password. The email SHALL identify only one account (checked case-insensitively) and MUST be a valid email format. Passwords SHALL be hashed (bcrypt) and MUST NOT be stored as plaintext. Successful registration SHALL create the account and return an authenticated session (FR-AUTH-001).

#### Scenario: Successful registration

- **WHEN** a user submits a unique, valid email address and a password meeting the minimum length requirement to `POST /api/auth/register`
- **THEN** the system responds `201 Created` with an `accessToken` and `user` object, and sets an HTTP-only `refreshToken` cookie

#### Scenario: Invalid email format is rejected

- **WHEN** a user submits a malformed email address to `POST /api/auth/register`
- **THEN** the system responds `400 Bad Request` with `code: "VALIDATION_ERROR"` and does not create an account

#### Scenario: Duplicate email is rejected

- **WHEN** a user submits an email address that already belongs to an existing account (case-insensitive match) to `POST /api/auth/register`
- **THEN** the system responds `422 Unprocessable Entity` with `code: "CONFLICT"` and does not create a second account

#### Scenario: Password below minimum length is rejected

- **WHEN** a user submits a password shorter than 8 characters to `POST /api/auth/register`
- **THEN** the system responds `400 Bad Request` with `code: "VALIDATION_ERROR"` and does not create an account

### Requirement: User Login

The system SHALL allow a registered user to authenticate using their email address and password. Authentication SHALL be rejected when credentials are invalid, using a generic error that does not reveal whether the email or password was incorrect. Successful login SHALL establish an authenticated session (FR-AUTH-002).

#### Scenario: Successful login

- **WHEN** a registered user submits their correct email and password to `POST /api/auth/login`
- **THEN** the system responds `200 OK` with an `accessToken` and `user` object, and sets an HTTP-only `refreshToken` cookie

#### Scenario: Incorrect password is rejected

- **WHEN** a registered user submits their correct email with an incorrect password to `POST /api/auth/login`
- **THEN** the system responds `401 Unauthorized` with `code: "UNAUTHORIZED"` and a generic invalid-credentials message

#### Scenario: Unregistered email is rejected

- **WHEN** a user submits an email address with no matching account to `POST /api/auth/login`
- **THEN** the system responds `401 Unauthorized` with `code: "UNAUTHORIZED"` and the same generic invalid-credentials message used for an incorrect password

### Requirement: Authenticated Session Continuity

The system SHALL issue short-lived (15 minute) JWT access tokens and persist a 7-day refresh token enabling session renewal. Protected endpoints SHALL require a valid, unexpired access token via the `Authorization` header. Expired or invalid access tokens MUST NOT grant protected access. `POST /api/auth/refresh` SHALL rotate the refresh token: the presented refresh token is invalidated and a new access token and refresh token are issued (FR-AUTH-003).

#### Scenario: Valid access token grants protected access

- **WHEN** a request to a protected endpoint includes a valid, unexpired access token in the `Authorization` header
- **THEN** the request is processed as the authenticated user

#### Scenario: Missing or invalid access token is rejected

- **WHEN** a request to a protected endpoint has no `Authorization` header, or the token is malformed, unsigned, or expired
- **THEN** the system responds `401 Unauthorized` with `code: "UNAUTHORIZED"` and does not process the request

#### Scenario: Valid refresh token renews the session

- **WHEN** `POST /api/auth/refresh` is called with a valid, unexpired `refreshToken` cookie
- **THEN** the system responds `200 OK` with a new `accessToken`, invalidates the presented refresh token, and sets a new `refreshToken` cookie

#### Scenario: Expired or invalid refresh token is rejected

- **WHEN** `POST /api/auth/refresh` is called with a missing, expired, or unrecognized `refreshToken` cookie
- **THEN** the system responds `401 Unauthorized` with `code: "UNAUTHORIZED"` and does not issue new tokens

### Requirement: User Logout

The system SHALL allow an authenticated user to log out. Logout SHALL invalidate the refresh token associated with the current session so it can no longer be used to renew the session. A previously invalidated (or already-missing) refresh token presented afterward SHALL NOT succeed (FR-AUTH-004).

#### Scenario: Logout ends the current session

- **WHEN** an authenticated user calls `POST /api/auth/logout` with a valid access token and their current `refreshToken` cookie
- **THEN** the system responds `200 OK`, deletes the corresponding stored refresh token, and clears the `refreshToken` cookie

#### Scenario: Reusing an invalidated refresh token after logout is rejected

- **WHEN** `POST /api/auth/refresh` is called with a `refreshToken` cookie value that was already invalidated by a prior logout
- **THEN** the system responds `401 Unauthorized` with `code: "UNAUTHORIZED"` and does not renew the session

#### Scenario: Logout without a matching refresh token still succeeds

- **WHEN** an authenticated user calls `POST /api/auth/logout` with a valid access token but a missing or already-invalidated `refreshToken` cookie
- **THEN** the system responds `200 OK` and clears the `refreshToken` cookie without error

### Requirement: Forgot Password Request

The system SHALL allow a user to request password recovery by submitting an email address to `POST /api/auth/forgot-password`. If the email matches an existing account, the system SHALL generate a 6-digit numeric OTP, hash it (SHA-256) into `User.resetOtpHash`, and set `User.resetOtpExpires` to 15 minutes from generation. The plaintext OTP SHALL be logged to the server console (simulating email delivery) and MUST NOT be included in the HTTP response. To prevent account enumeration, the endpoint SHALL return the same `200 OK` response regardless of whether the submitted email matches an existing account (FR-AUTH-005).

#### Scenario: Password recovery requested for an eligible account

- **WHEN** a user submits an email address matching an existing account to `POST /api/auth/forgot-password`
- **THEN** the system generates a 6-digit OTP, hashes and stores it with a 15-minute expiry on the matching `User` record, and responds `200 OK` without including the OTP in the response body

#### Scenario: Reset notification is logged rather than emailed

- **WHEN** a password-recovery OTP is generated for an eligible account
- **THEN** the plaintext OTP is written to the server console and no real email is sent

#### Scenario: Password recovery for a non-existent account does not reveal account existence

- **WHEN** a user submits an email address with no matching account to `POST /api/auth/forgot-password`
- **THEN** the system performs no database write and responds `200 OK` with the same message used for an eligible account

#### Scenario: A new forgot-password request invalidates a previously issued unused OTP

- **WHEN** a user submits two consecutive `POST /api/auth/forgot-password` requests for the same eligible account
- **THEN** the second request overwrites `resetOtpHash` and `resetOtpExpires`, and the OTP issued by the first request no longer satisfies `POST /api/auth/reset-password`

### Requirement: Password Reset Using OTP

The system SHALL allow a user to submit an email address, a 6-digit OTP, and a new password to `POST /api/auth/reset-password`. A valid, unexpired, matching OTP SHALL permit the password to be reset: the new password is hashed (bcrypt) into `User.passwordHash`, and `resetOtpHash`/`resetOtpExpires` are cleared so the OTP cannot be reused. An invalid, expired, or already-consumed OTP MUST NOT permit password reset and SHALL respond `400 Bad Request` with `code: "VALIDATION_ERROR"` (FR-AUTH-006).

#### Scenario: Successful password reset with a valid unexpired OTP

- **WHEN** a user submits their email, a valid unexpired OTP, and a new password meeting the minimum length requirement to `POST /api/auth/reset-password`
- **THEN** the system responds `200 OK`, updates `passwordHash` to the new password's hash, and clears `resetOtpHash` and `resetOtpExpires`

#### Scenario: Invalid OTP is rejected

- **WHEN** a user submits an OTP that does not match the stored hash for their account to `POST /api/auth/reset-password`
- **THEN** the system responds `400 Bad Request` with `code: "VALIDATION_ERROR"` and does not change the password

#### Scenario: Expired OTP is rejected

- **WHEN** a user submits an OTP that matches the stored hash but was generated more than 15 minutes ago to `POST /api/auth/reset-password`
- **THEN** the system responds `400 Bad Request` with `code: "VALIDATION_ERROR"` and does not change the password

#### Scenario: Reusing a previously consumed OTP is rejected

- **WHEN** a user submits an OTP that was already successfully used in a prior password reset to `POST /api/auth/reset-password`
- **THEN** the system responds `400 Bad Request` with `code: "VALIDATION_ERROR"` and does not change the password

#### Scenario: New password is usable for subsequent login

- **WHEN** a password reset has succeeded for a user's account
- **THEN** the user can authenticate via `POST /api/auth/login` using the new password
