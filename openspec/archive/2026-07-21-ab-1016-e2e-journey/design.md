## Context

AB-1001 through AB-1015 are archived. Every backend domain (auth, notes, tags, search, sharing, versions) and every frontend screen (auth pages, notes list, editor, search, share modal, version-history drawer) exists and is individually tested — backend via Vitest+Supertest against `notes_test`, frontend components via Vitest+RTL+MSW. Playwright infra exists (`frontend/playwright.config.ts`, `frontend/e2e/smoke.spec.ts`) but today only proves the app shell renders, explicitly without the backend running (`testing-foundation` capability, "Browser-Based End-to-End Testing Support").

FR-E2E-001 asks for one more thing none of the prior tickets covered: a single browser session that proves the pieces work together against the _real_ backend and Postgres, per `docs/SDS.md` §13 ("verifying the entire registration-to-sharing lifecycle").

While mapping the approved spec's scenario onto the actual codebase, two gaps surfaced that the approved proposal's "no new UI components" constraint has to work around (both resolved with the user during this planning session):

1. **No public share-viewing page.** `frontend/src/routes/AppRouter.tsx` has no `/share/:token` route. `ShareModal.tsx` only generates/revokes links for the owner. `GET /api/share/:token` (SDS §3.5.3) is a backend-only contract today.
2. **No tag-creation UI.** `frontend/src/features/tags/tagsApi.ts` only implements `GET /api/tags`. `TagPicker` and `TagFilterControls` both render nothing (`tags.length === 0` short-circuit) until a tag already exists — there is no browser flow that creates one.

Decision (confirmed with user): the journey test uses Playwright's `APIRequestContext` to perform these two steps directly against the backend (mirroring the extraction/request pattern already used in `backend/src/routes/share.*.test.ts`), then continues driving the real browser UI for every step that does have one. This keeps the proposal's "no new frontend code" boundary intact while still exercising the real endpoints.

## Goals / Non-Goals

**Goals:**

- One Playwright spec, `frontend/e2e/journey.spec.ts`, driving a single continuous user session: register → login → create note → create+assign+filter tag → search → generate+view share link → edit note → view+restore a version → logout.
- The same test asserts zero uncaught page errors / console errors across the whole run (`FR-E2E-001`'s second scenario), via `page.on("pageerror")` / `page.on("console")` listeners registered before any navigation and asserted at the end.
- Test runs against the real backend (`NODE_ENV=test`, pointed at `notes_test`/port 5433) and the real Playwright-managed frontend preview server, per `frontend/CLAUDE.md`'s documented `test:e2e` prerequisite.
- Fresh, dynamically generated email per run so repeated local/CI runs never collide on the `User.email` unique constraint.

**Non-Goals:**

- No new frontend pages, components, or routes (including no `/share/:token` viewer page) — confirmed as an accepted, scoped-out gap for this ticket, not fixed here.
- No new tag-management UI.
- No changes to `packages/shared`, Prisma schema, or any backend/frontend application source.
- No password-reset/OTP step — not listed among FR-E2E-001's named capabilities (registration, authentication, note management, tagging, search, sharing, version history, logout).
- `frontend/e2e/smoke.spec.ts` is untouched.

## Decisions

### 1. Single test file, single `test()`, internal `test.step()` segments

FR-E2E-001 names one scenario for the functional journey. Rather than splitting into 8 separate Playwright tests (which would fragment the "one continuous session" requirement and complicate state hand-off between steps), the journey is one `test()` block using `test.step()` per capability (register, login, note, tag, search, share, version-history, logout) for readable trace/report output. This matches the previously agreed "one test, two assertions" structure — the second assertion (no application errors) wraps the whole run rather than being a second test.

**Alternative considered**: two tests (functional + error-free), sharing state via a fixture. Rejected — doubles browser/backend setup cost for a check that's naturally a continuous assertion over the same run, and the user already selected the single-test structure in `/spec`.

### 2. Non-UI steps go through `request` (APIRequestContext), not `page`

For share-link viewing and tag creation, the test uses Playwright's built-in `request` fixture (or a `request.newContext()` scoped to `API_BASE_URL`) with the `Authorization: Bearer <accessToken>` header captured from the UI login step. This is the same pattern the backend's own integration tests use (`extractToken(shareLink)` helpers in `backend/src/routes/share.*.test.ts`), so the journey stays consistent with existing test conventions rather than inventing a new one.

**Alternative considered**: Skip these two capabilities entirely since no UI exists. Rejected — FR-E2E-001 explicitly names "tagging" and "sharing" as required journey capabilities; verifying them via the real HTTP contract (still against the real running backend) is closer to the spec's intent than omitting them.

### 3. Test data isolation

- Email: `journey.${crypto.randomUUID()}@example.com` generated at test run time (not a fixed constant), avoiding the `User.email` unique constraint across repeated runs.
- No explicit teardown/cleanup step is added — consistent with `docs/SDS.md` §13's existing test-isolation strategy (truncation/rollback handled at the suite level for backend integration tests); the E2E run's own created rows are inert leftover data in `notes_test`, matching how the existing smoke test and backend integration suites already leave no special-cased cleanup for one-off E2E data.

### 4. Environment prerequisites (documentation only, no code change)

Running this spec for real requires:

- Both Postgres containers up (`docker compose up notes_dev notes_test`).
- Backend started with `NODE_ENV=test` against `TEST_DATABASE_URL` (so `authRateLimiters.ts`'s `skipInTestEnv()` bypasses the 3/hour registration and 5/minute login limiters — otherwise repeated local runs of this single test would exhaust those limits within a few executions).
- Backend's `WEB_ORIGIN` set to match the Playwright preview server's origin (`http://localhost:4173` per `playwright.config.ts`, not the Vite dev server's `5173`), since `app.ts` configures `cors({ origin: process.env.WEB_ORIGIN, credentials: true })` and the frontend's `apiClient.ts` sends `credentials: "include"` — a mismatched origin silently fails every request with a CORS error, which is exactly the kind of "application error" this ticket is asserting against.

This is an operational/env-configuration fact, not an architecture change, so no source file needs to encode it — `/tasks` will decide the minimal way to surface it (e.g., a short header comment in `journey.spec.ts` itself, since editing `frontend/CLAUDE.md` beyond its current scope is not required by this ticket).

## Risks / Trade-offs

- **[Risk]** Autosave's 2-second debounce (`SDS §11.3`) means the edit-note step must wait for the debounce window (and the "Saved" status text) before proceeding to version history, or the version snapshot won't exist yet. → Mitigation: assert on the autosave "Saved" status text (`NoteEditorPage.tsx`'s `autosaveStatus === "saved"` render) before opening the version-history drawer, rather than a fixed `waitForTimeout`.
- **[Risk]** `NoteEditorPage`'s auto-create-on-mount behavior (`/notes/new` fires `POST /api/notes` on load) means the note already exists with title "Untitled" before the test does anything — the journey must wait for the URL to become `/notes/:id` (via `page.waitForURL`) before interacting with the title/editor, not assume note creation is a discrete user action. → Mitigation: explicit `waitForURL(/\/notes\/[^/]+$/)` after navigating to `/notes/new`.
- **[Risk]** Running the real backend for this one suite is slower and more environment-sensitive than the mocked component tests. → Mitigation: this is explicitly the point of an E2E suite (SDS §13); no mitigation needed beyond the documented prerequisites above.
- **[Trade-off]** Verifying share/tag creation via `request` instead of a real UI means those two steps don't prove the _frontend_ renders anything for them — only that the backend contract works. Accepted per the user's explicit decision in `/spec` and this `/plan` session; the missing UI itself remains an accepted, unfixed gap outside this ticket's scope.

## Migration Plan

Not applicable — this change adds a test file only. No deployment, data migration, or rollback considerations beyond normal source control (revert the new spec file if it proves flaky).

## Open Questions

- Exact mechanism for surfacing the `WEB_ORIGIN`/`NODE_ENV=test` prerequisite (spec-file header comment vs. no documentation at all) is deferred to `/tasks`, since it doesn't affect the requirement/behavior being implemented.
