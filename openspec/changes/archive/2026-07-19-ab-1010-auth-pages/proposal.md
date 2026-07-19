## Why

The backend authentication API (registration, login, logout, refresh, forgot-password, OTP reset — AB-1002/AB-1003) has no frontend interface yet. Users cannot register, log in, recover, or reset a password through the application. This ticket delivers the first frontend-facing capability, establishing the app's routing, protected-route, and client auth-session patterns that later frontend tickets (AB-1011 onward) will build on.

## What Changes

- Add React Router DOM as the frontend routing dependency (pinned version), with public routes (`/login`, `/register`, `/forgot-password`, `/reset-password`) and a protected-route wrapper for authenticated pages.
- Add a registration page that calls `POST /api/auth/register`, displays field-level and operation errors, and on success authenticates the user.
- Add a login page that calls `POST /api/auth/login`, displays invalid-credential and validation errors, and on success authenticates the user.
- Add a forgot-password page that calls `POST /api/auth/forgot-password` and displays a confirmation message, linking to the reset-password page.
- Add a reset-password page that collects email, OTP, and new password, calls `POST /api/auth/reset-password`, and displays validation/OTP errors or success.
- Wire the existing Zustand `AuthStore` (`accessToken`, `user`, `login()`, `logout()`, `renewSession()`) to these pages; the access token is held in memory only, never persisted to `localStorage`/`sessionStorage`.
- On app load, silently attempt `POST /api/auth/refresh` (using the existing HTTP-only refresh cookie) to restore a session before rendering protected routes, so a page reload does not always force logout.
- Add a minimal authenticated placeholder page (shows the logged-in user's email and a logout button) as the post-login/post-registration landing route; AB-1011 will replace it with the real notes list.
- All four forms use plain controlled React state validated on submit against the existing Zod schemas in `packages/shared` (`registerRequestSchema`, `loginRequestSchema`, `forgotPasswordRequestSchema`, `resetPasswordRequestSchema`) — no new form-state library.

## Capabilities

### New Capabilities

- `auth-ui`: Frontend registration, login, forgot-password, and OTP reset-password pages; protected routing; session bootstrap via silent refresh; and the authenticated placeholder landing page with logout.

### Modified Capabilities

_None — this ticket only adds frontend UI on top of the existing `user-authentication` backend capability; no backend requirement changes._

## Impact

- **New dependency**: `react-router-dom` (pinned version) added to `frontend/package.json`.
- **New frontend code**: route definitions, four auth page components, a protected-route wrapper, and a minimal authenticated placeholder page, all under `frontend/src/`.
- **Modified frontend code**: `App.tsx`/`main.tsx` updated to mount the router; Zustand `AuthStore` wired to real API calls instead of being unused.
- **No backend or shared-package API changes** — consumes the existing `/api/auth/*` endpoints and existing shared DTOs/schemas as-is.
