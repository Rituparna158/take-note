## 1. Dependencies & Environment

- [x] 1.1 Add `react-router-dom` pinned at `7.9.4` to `frontend/package.json` (`pnpm --filter frontend add react-router-dom@7.9.4`); run `pnpm install` at the repo root to update the lockfile. (Design Decision 1, 8)
- [x] 1.2 Document the `VITE_API_BASE_URL` frontend env var (default `http://localhost:3000`) — add `frontend/.env.example` with the variable, matching the pattern of `backend/.env.example`. (Design Decision 3, Risk: first frontend env var)

## 2. API Client & Auth Service Layer

- [x] 2.1 Create `frontend/src/lib/apiClient.ts`: `fetch` wrapper reading `import.meta.env.VITE_API_BASE_URL` (fallback `http://localhost:3000`), always sending `credentials: 'include'`, attaching `Authorization: Bearer <accessToken>` when present, and parsing the `{ code, message, fields }` error shape into a typed `ApiError`. (Design Decision 3; SDS §3, §3.1)
- [x] 2.2 Create `frontend/src/features/auth/authApi.ts` with one function per endpoint — `register`, `login`, `logout`, `refresh`, `forgotPassword`, `resetPassword` — each validating its request payload with the matching `@take-note/shared` schema and parsing the response with `authResponseSchema`/`messageResponseSchema`. (Design Decision 3; SDS §3.1.1–3.1.6)
  - _Candidate for subagent delegation (>45 min): six endpoint functions plus shared-schema wiring and `ApiError` handling._

## 3. AuthStore (Zustand)

- [x] 3.1 Create `frontend/src/stores/authStore.ts`: `accessToken`, `user`, `status` (`'idle' | 'restoring' | 'authenticated' | 'unauthenticated'`), and `setSession()`/`clearSession()` actions only — no fetch logic inside the store. (Design Decision 2; AGENTS.md §5, SDS §11.2)

## 4. Routing & Protected Route

- [x] 4.1 Create `frontend/src/routes/ProtectedRoute.tsx`: reads `authStore`, renders a loading state while `status === 'restoring'`, `<Navigate to="/login" replace />` while `'unauthenticated'`, otherwise renders its children. (Design Decision 1, 6)
- [x] 4.2 Create `frontend/src/routes/AppRouter.tsx` using `BrowserRouter`/`Routes`/`Route` (declarative mode only — no `createBrowserRouter`/loaders) wiring the five routes: `/register`, `/login`, `/forgot-password`, `/reset-password` (public), and `/` (`ProtectedRoute` → `AuthenticatedPlaceholderPage`). No catch-all/404 route. (Design Decision 1, 5)
- [x] 4.3 Update `frontend/src/App.tsx`/`frontend/src/main.tsx` to mount `AppRouter` and call `authApi.refresh()` once on mount to bootstrap the session before rendering protected routes, per Design Decision 6. (Design Decision 6; FR-AUTH-003)

## 5. Auth Pages

- [x] 5.1 Create `frontend/src/features/auth/RegisterPage.tsx`: controlled email/password fields, submit validates via `registerRequestSchema.safeParse`, calls `authApi.register`, shows inline field errors and a top-level `ApiError` alert, navigates to `/` on success. (auth-ui spec: Registration Page requirement; FR-UI-AUTH-001)
- [x] 5.2 Create `frontend/src/features/auth/LoginPage.tsx`: controlled email/password fields, submit validates via `loginRequestSchema.safeParse`, calls `authApi.login`, shows a generic invalid-credentials error on `401`, navigates to `/` on success. (auth-ui spec: Login Page requirement; FR-UI-AUTH-001)
- [x] 5.3 Create `frontend/src/features/auth/ForgotPasswordPage.tsx`: controlled email field, submit validates via `forgotPasswordRequestSchema.safeParse`, calls `authApi.forgotPassword`, displays the returned confirmation message, links to `/reset-password`. (auth-ui spec: Forgot Password Page requirement; FR-UI-AUTH-001)
- [x] 5.4 Create `frontend/src/features/auth/ResetPasswordPage.tsx`: controlled email/OTP/new-password fields, submit validates via `resetPasswordRequestSchema.safeParse`, calls `authApi.resetPassword`, shows inline/operation errors on failure (invalid/expired/consumed OTP, validation) and a success message with a link to `/login` on success. (auth-ui spec: Reset Password Page requirement; FR-UI-AUTH-001)
- [x] 5.5 Create `frontend/src/features/auth/AuthenticatedPlaceholderPage.tsx`: displays `authStore.user.email` and a logout button; logout calls `authApi.logout()`, then unconditionally clears `authStore` and navigates to `/login`. (auth-ui spec: Authenticated Placeholder Page and Protected Routing requirement; Design Decision 7)

## 6. Automated Tests (Vitest + React Testing Library + MSW)

- [x] 6.1 Add MSW handlers for `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password` covering success and documented error responses, in `frontend/src/test/mocks/handlers.ts`.
- [x] 6.2 `RegisterPage.test.tsx` — one uniquely named test per scenario: _Registration form is available_, _Successful registration grants access to authenticated functionality_, _Registration failure shows visible error feedback_. (auth-ui spec: Registration Page)
- [x] 6.3 `LoginPage.test.tsx` — one uniquely named test per scenario: _Login form is available_, _Successful login grants access to authenticated functionality_, _Login failure shows visible error feedback_. (auth-ui spec: Login Page)
- [x] 6.4 `ForgotPasswordPage.test.tsx` — one uniquely named test for scenario: _Forgot-password flow is available_. (auth-ui spec: Forgot Password Page)
- [x] 6.5 `ResetPasswordPage.test.tsx` — one uniquely named test per scenario: _OTP and new-password input capability is available_, _Reset-password failure shows visible error feedback_, _Successful reset allows login with the new password_. (auth-ui spec: Reset Password Page)
- [x] 6.6 `ProtectedRoute.test.tsx` / `AuthenticatedPlaceholderPage.test.tsx` — one uniquely named test per scenario: _Authenticated user can access the placeholder page_, _Unauthenticated user is denied access to the placeholder page_, _Logout ends the session and returns to login_. (auth-ui spec: Authenticated Placeholder Page and Protected Routing)
- [x] 6.7 `App.test.tsx` (session bootstrap) — one uniquely named test per scenario: _A valid refresh session is restored on reload_, _A missing or invalid refresh session is not restored_. (auth-ui spec: Session Restoration on Reload; FR-AUTH-003)
  - _Candidate for subagent delegation (>45 min): 15 scenario tests across 6 files, all requiring MSW setup._

## 7. Quality Gates & Manual Smoke Test

- [x] 7.1 Run `pnpm build` — must complete with 0 errors, 0 warnings.
- [x] 7.2 Run `pnpm lint --max-warnings 0` — must pass cleanly.
- [x] 7.3 Run `pnpm test` — all unit/component tests (frontend) must pass; confirm new code meets the 80% coverage requirement (NFR-003).
- [x] 7.4 Manually smoke test the happy path: register → land on placeholder page → logout → login → land on placeholder page → reload page (session restored) → logout → forgot-password → reset-password (using OTP logged to console) → login with new password.
- [x] 7.5 Manually smoke test the defined error scenarios: invalid email/short password on register, wrong password/unknown email on login, invalid/expired OTP on reset-password, and reload with no session (redirects to `/login`).

## Notes on Parallelization

- No Git worktree parallelization applies to this ticket — it is entirely frontend-only, and tasks are largely sequential (AuthStore → apiClient/authApi → pages/routing → tests) rather than independent workstreams.
