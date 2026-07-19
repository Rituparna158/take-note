## ADDED Requirements

### Requirement: Registration Page

The frontend SHALL provide a registration page at `/register` with a form for email and password. On submit, the page SHALL call `POST /api/auth/register`. On success, the returned `accessToken` and `user` SHALL be stored in the `AuthStore` and the user SHALL be navigated to the authenticated placeholder page. On failure, the page SHALL display visible validation or operation error feedback and SHALL NOT navigate away (FR-UI-AUTH-001).

#### Scenario: Registration form is available

- **WHEN** a user navigates to `/register`
- **THEN** a registration form with email and password fields is displayed

#### Scenario: Successful registration grants access to authenticated functionality

- **WHEN** a user submits a valid, unique email and a password meeting the minimum length requirement on the registration form
- **THEN** `POST /api/auth/register` succeeds, the `AuthStore` is populated with the returned access token and user, and the user is navigated to the authenticated placeholder page

#### Scenario: Registration failure shows visible error feedback

- **WHEN** `POST /api/auth/register` responds with a validation error (invalid email, short password) or a conflict error (email already registered)
- **THEN** the registration page displays the corresponding error message and the user remains on `/register`

### Requirement: Login Page

The frontend SHALL provide a login page at `/login` with a form for email and password. On submit, the page SHALL call `POST /api/auth/login`. On success, the returned `accessToken` and `user` SHALL be stored in the `AuthStore` and the user SHALL be navigated to the authenticated placeholder page. On failure, the page SHALL display visible error feedback without exposing whether the email or password was incorrect (FR-UI-AUTH-001).

#### Scenario: Login form is available

- **WHEN** a user navigates to `/login`
- **THEN** a login form with email and password fields is displayed

#### Scenario: Successful login grants access to authenticated functionality

- **WHEN** a registered user submits their correct email and password on the login form
- **THEN** `POST /api/auth/login` succeeds, the `AuthStore` is populated with the returned access token and user, and the user is navigated to the authenticated placeholder page

#### Scenario: Login failure shows visible error feedback

- **WHEN** `POST /api/auth/login` responds `401 Unauthorized` for an incorrect password or an unregistered email
- **THEN** the login page displays a generic invalid-credentials error message and the user remains on `/login`

### Requirement: Forgot Password Page

The frontend SHALL provide a forgot-password page at `/forgot-password` with a form for the account email. On submit, the page SHALL call `POST /api/auth/forgot-password` and display the resulting confirmation message, then allow the user to proceed to the reset-password page (FR-UI-AUTH-001).

#### Scenario: Forgot-password flow is available

- **WHEN** a user navigates to `/forgot-password` and submits their email address
- **THEN** `POST /api/auth/forgot-password` is called and the page displays the returned confirmation message regardless of whether the email matches an account

### Requirement: Reset Password Page

The frontend SHALL provide a reset-password page at `/reset-password` with a form for email, 6-digit OTP, and new password. On submit, the page SHALL call `POST /api/auth/reset-password`. On success, the page SHALL display a success message and allow navigation to `/login`. On failure, the page SHALL display visible error feedback for an invalid, expired, or already-consumed OTP or a validation error (FR-UI-AUTH-001).

#### Scenario: OTP and new-password input capability is available

- **WHEN** a user navigates to `/reset-password`
- **THEN** a form with email, OTP, and new-password fields is displayed

#### Scenario: Reset-password failure shows visible error feedback

- **WHEN** `POST /api/auth/reset-password` responds `400 Bad Request` for an invalid, expired, or already-consumed OTP, or a password below the minimum length
- **THEN** the reset-password page displays the corresponding error message and the password is not changed

#### Scenario: Successful reset allows login with the new password

- **WHEN** a user submits a valid unexpired OTP and a new password meeting the minimum length requirement on the reset-password form
- **THEN** `POST /api/auth/reset-password` succeeds, the page displays a success message, and the user can subsequently authenticate via the login page using the new password

### Requirement: Authenticated Placeholder Page and Protected Routing

The frontend SHALL provide a minimal authenticated placeholder page displaying the logged-in user's email and a logout control, reachable only when a valid session exists in the `AuthStore`. An unauthenticated user attempting to access the placeholder page SHALL be redirected to `/login`. Selecting logout SHALL call `POST /api/auth/logout`, clear the `AuthStore`, and navigate the user to `/login` (FR-UI-AUTH-001, FR-AUTH-004).

#### Scenario: Authenticated user can access the placeholder page

- **WHEN** a user with a valid session in the `AuthStore` navigates to the authenticated placeholder page
- **THEN** the page displays the user's email and a logout control

#### Scenario: Unauthenticated user is denied access to the placeholder page

- **WHEN** a user with no valid session in the `AuthStore` attempts to navigate to the authenticated placeholder page
- **THEN** the user is redirected to `/login` and the placeholder page content is not displayed

#### Scenario: Logout ends the session and returns to login

- **WHEN** an authenticated user selects the logout control on the placeholder page
- **THEN** `POST /api/auth/logout` is called, the `AuthStore` is cleared, and the user is navigated to `/login`

### Requirement: Session Restoration on Reload

On application load, the frontend SHALL attempt to restore an existing session by calling `POST /api/auth/refresh` before rendering protected routes, since the access token is held in memory only and does not survive a page reload. If the refresh succeeds, the returned access token and user SHALL populate the `AuthStore` and protected routes SHALL render normally. If the refresh fails, the user SHALL be treated as unauthenticated (FR-AUTH-003).

#### Scenario: A valid refresh session is restored on reload

- **WHEN** the application loads and an unexpired `refreshToken` cookie is present
- **THEN** `POST /api/auth/refresh` succeeds, the `AuthStore` is populated with the returned access token and user, and a previously authenticated user reaches the authenticated placeholder page without needing to log in again

#### Scenario: A missing or invalid refresh session is not restored

- **WHEN** the application loads and the `refreshToken` cookie is missing, expired, or invalid
- **THEN** `POST /api/auth/refresh` fails, the `AuthStore` remains empty, and protected routes redirect the user to `/login`
