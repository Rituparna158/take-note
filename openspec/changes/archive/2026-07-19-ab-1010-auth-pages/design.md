## Context

The frontend workspace currently has no routing, no client-side auth state, and no API client — `App.tsx` is a static placeholder and `main.tsx` mounts it directly (`frontend/src/main.tsx:12-16`). The backend already exposes the full `/api/auth/*` contract (register, login, logout, refresh, forgot-password, reset-password) per SDS §3.1, and `packages/shared/src/auth/schemas.ts` already exports the Zod request/response schemas this ticket needs (`registerRequestSchema`, `loginRequestSchema`, `forgotPasswordRequestSchema`, `resetPasswordRequestSchema`, `authResponseSchema`, `messageResponseSchema`). No shared-package changes are required.

This design implements FR-UI-AUTH-001 (frontend auth pages) and the frontend-facing halves of FR-AUTH-003 (session continuity) and FR-AUTH-004 (logout), per the approved proposal and the `auth-ui` delta spec.

## Goals / Non-Goals

**Goals:**

- Establish the app's first routing structure and a reusable protected-route pattern that AB-1011 onward will extend.
- Implement the four auth pages (register, login, forgot-password, reset-password) against the existing `/api/auth/*` contract.
- Introduce the `AuthStore` (Zustand) described in AGENTS.md §5 / SDS §11.2, currently unimplemented, holding only in-memory session state.
- Restore a session on page reload via silent `POST /api/auth/refresh`, consistent with FR-AUTH-003.
- Provide the minimal authenticated placeholder page (email + logout) as the shared landing target for register/login/reset success and session restoration.

**Non-Goals:**

- The real notes list UI (AB-1011) — the placeholder page is intentionally minimal and will be replaced, not extended, by that ticket.
- A 404 / catch-all route or general navigation chrome (header, nav bar) — out of scope; only the five routes needed by this ticket are defined.
- Any new shared DTOs, validation rules, or backend/API changes — this ticket only consumes what already exists.
- A form-state library (`react-hook-form`) — forms use plain controlled state per the approved proposal.

## Decisions

### 1. Routing library and mode: `react-router-dom` (declarative mode)

Add `react-router-dom` pinned at `7.9.4` (current stable major, verified via Context7 against the `react-router` v7 docs, which `react-router-dom` re-exports for DOM apps). Use **declarative mode** (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useNavigate`) rather than data mode (`createBrowserRouter`/loaders/middleware).

**Why:** This project's architecture already assigns server state to TanStack Query and client UI state to Zustand (SDS §11). Data-router loaders would introduce a second, competing mechanism for fetching/gating data outside that split, and would couple auth checks to route configuration instead of the reactive `AuthStore` the SDS already specifies. Declarative mode lets a plain `<ProtectedRoute>` component read `AuthStore` reactively, matching the existing component-driven testing approach (RTL + MSW).

**Alternative considered:** Data mode with an `authMiddleware`/loader `redirect()` (shown in the React Router v7 docs). Rejected — it would require modeling auth as route data instead of Zustand state, contradicting SDS §11.2, and is harder to unit test with the project's existing RTL/MSW component-test pattern.

### 2. New `AuthStore` (Zustand)

Create `frontend/src/stores/authStore.ts` holding `accessToken`, `user`, and a `status` (`'idle' | 'restoring' | 'authenticated' | 'unauthenticated'`), with `setSession()` and `clearSession()` actions only. The store does not perform any network calls itself.

**Why:** AGENTS.md §5 and SDS §11.2 describe `AuthStore` as client UI/session state, not a data-fetching layer. Keeping it action-only (no fetch logic inside the store) matches frontend/CLAUDE.md's rule that business logic belongs in hooks/service layers, not stores or components.

### 3. Auth service layer and API client

- `frontend/src/lib/apiClient.ts`: a small `fetch` wrapper reading `import.meta.env.VITE_API_BASE_URL` (falls back to `http://localhost:3000` to match SDS §8's default `PORT=3000`), always sending `credentials: 'include'` (required so the browser sends/receives the HTTP-only `refreshToken` cookie per the backend's `cors({ credentials: true })` config in `backend/src/app.ts`), and attaching `Authorization: Bearer <accessToken>` when one is present in `AuthStore`. Parses the standard `{ code, message, fields }` error shape (SDS §3) into a typed `ApiError`.
- `frontend/src/features/auth/authApi.ts`: one function per endpoint (`register`, `login`, `logout`, `refresh`, `forgotPassword`, `resetPassword`), each validating its request payload with the matching `packages/shared` schema, calling `apiClient`, and parsing the response with `authResponseSchema` / `messageResponseSchema`. These functions call `AuthStore` actions (`setSession`/`clearSession`) directly; page components call `authApi`, never `fetch` directly.

**Why:** Keeps DTO validation and parsing centralized against the shared schemas (packages/shared/CLAUDE.md), and keeps page components thin per frontend/CLAUDE.md.

### 4. Form handling: plain controlled state + Zod on submit

Each of the four forms uses `useState` per field, validates the full payload on submit via the relevant `packages/shared` schema's `safeParse`, and renders `result.error` field issues inline. A separate top-level alert region shows operation-level errors (`ApiError.message`) from a failed API call (invalid credentials, conflict, rate limit, invalid/expired OTP).

**Why:** Matches the approved proposal's decision to avoid adding a form-state library; the same schemas already used by the backend keep client/server validation rules identical (no duplicated rules per AGENTS.md §12).

### 5. Route table

```
/register           -> RegisterPage (public)
/login               -> LoginPage (public)
/forgot-password      -> ForgotPasswordPage (public)
/reset-password       -> ResetPasswordPage (public)
/                    -> ProtectedRoute -> AuthenticatedPlaceholderPage
```

No catch-all/404 route is defined (see Non-Goals).

### 6. Session bootstrap on load

The root `App` component calls `authApi.refresh()` once on mount (before rendering any `Route`), setting `AuthStore.status` to `'restoring'` while pending. `ProtectedRoute` renders a minimal loading state while `status === 'restoring'`, redirects to `/login` (`<Navigate to="/login" replace />`) when `'unauthenticated'`, and renders its children when `'authenticated'`.

**Why:** Implements the approved "silent refresh on load" scope decision using the session-renewal mechanism already defined by FR-AUTH-003/SDS §3.1.4, without persisting the access token to storage (frontend/CLAUDE.md's in-memory-only rule).

### 7. Logout

`authApi.logout()` calls `POST /api/auth/logout`, then unconditionally clears `AuthStore` and navigates to `/login` regardless of the response outcome (the backend already treats logout as succeeding even with a missing/invalidated refresh token, per the `user-authentication` spec's "Logout without a matching refresh token still succeeds" scenario).

### 8. Dependency pinning

`react-router-dom` is added as an exact pinned version (`"7.9.4"`, no `^`/`~` range), matching the existing style of every other entry in `frontend/package.json` and FR-INFRA-002's pinned-dependency rule.

## Risks / Trade-offs

- **[Risk]** Silent refresh on every app load adds a network round-trip and a brief loading state even for first-time/never-logged-in visitors → **Mitigation**: acceptable one-time cost on initial load only; required to satisfy FR-AUTH-003's session-continuity intent on the frontend.
- **[Risk]** Auth endpoints are tightly rate-limited (SDS §5: login 5/min, register & forgot-password 3/hour, all keyed by IP or email) → **Mitigation**: no design change needed now; flagged so manual smoke testing and the Playwright E2E suite (AB-1016) pace requests deliberately.
- **[Risk]** React Router v7 ships both declarative and data-mode APIs; copying examples from docs/AI training data could accidentally introduce `createBrowserRouter`/loaders → **Mitigation**: implementation is constrained to `BrowserRouter`/`Routes`/`Route`/`Navigate`/`useNavigate` only, per Decision 1.
- **[Risk]** This is the first ticket to introduce a frontend env var (`VITE_API_BASE_URL`) → **Mitigation**: documented here with an explicit default so `pnpm --filter frontend dev`/`build`/`test` work without requiring a new `.env` file to be created first.

## Migration Plan

No database or backend migration is involved. Frontend dependency change: `pnpm --filter frontend add react-router-dom@7.9.4` followed by `pnpm install` at the repo root to update the lockfile. Rollback is a plain revert of the dependency addition and the new frontend files; no backend or shared-package state is touched.

## Open Questions

None outstanding — the unmatched-route/404 case is deliberately deferred (see Non-Goals) rather than left as an open question.
