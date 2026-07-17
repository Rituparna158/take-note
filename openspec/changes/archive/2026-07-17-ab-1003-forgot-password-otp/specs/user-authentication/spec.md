## ADDED Requirements

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
