## Why

All 15 preceding tickets (AB-1001 through AB-1015) have delivered the backend APIs and frontend screens for the note-taking application in isolation, each verified by its own unit/integration/component tests. FR-E2E-001 requires one final automated check that these pieces actually work together through the real browser UI against the real backend and database — registration through logout — closing out the mandatory ticket sequence (FRS §18) before the project can be considered complete.

## What Changes

- Add a full-journey Playwright spec (`frontend/e2e/journey.spec.ts`) that drives one continuous browser session through: registration → login → note creation → tag creation/assignment/filtering → full-text search → public share-link generation and public (unauthenticated) viewing → version history view and restore → logout, run against the real backend and `notes_test`/dev Postgres instance (not mocked).
- The same test asserts, throughout that run, that no uncaught page errors or console errors occur, satisfying the "completes without application errors" acceptance criterion alongside the functional-journey criterion, per user decision to cover both named FR-E2E-001 scenarios within one test via distinct assertions rather than two separate tests.
- The existing `frontend/e2e/smoke.spec.ts` (a minimal, backend-independent shell-render check tied to the `testing-foundation` capability) is left unchanged; it continues to prove Playwright infra works even without the backend running.
- No new API endpoints, database fields, or UI components are introduced — this ticket only adds test coverage that exercises existing functionality end-to-end.

## Capabilities

### New Capabilities

- `e2e-journey`: The complete, browser-based, cross-feature user journey test that validates registration, authentication, note management, tagging, search, sharing, version history, and logout work together against the real backend/database, and that the journey runs without application errors.

### Modified Capabilities

_None._ The existing `testing-foundation` capability's backend-independent E2E smoke-test requirement is unaffected — this change adds a distinct, additive capability rather than altering it.

## Impact

- **Affected code**: `frontend/e2e/journey.spec.ts` (new file). No backend, shared-package, or application UI source changes.
- **Affected systems**: Requires the backend server and both Postgres containers (`notes_dev`/`notes_test`) running locally per `docker compose up`, matching the existing `pnpm --filter frontend test:e2e` prerequisite documented in `frontend/CLAUDE.md`.
- **Test data**: The journey registers a fresh, dynamically generated unique email per run to avoid colliding with prior runs or other suites' fixtures.
- **No API/DTO/schema changes** — `packages/shared` is untouched.
