## 1. Test Helpers & Fixtures

- [x] 1.1 Add a unique test-user credentials generator (e.g. `frontend/e2e/helpers/testUser.ts`) producing a fresh `journey.<uuid>@example.com` email + fixed valid password per run (design §"Test data isolation")
- [x] 1.2 Add an authenticated API request helper for tag creation (`POST /api/tags` via Playwright's `request` fixture, `Authorization: Bearer <accessToken>` header) (design §"Non-UI steps go through request")
- [x] 1.3 Add a `extractShareToken(shareLink: string)` helper (last path segment of the returned share URL) plus a public, unauthenticated `GET /api/share/:token` request helper, mirroring the pattern in `backend/src/routes/share.*.test.ts` (design §"Non-UI steps go through request")
- [x] 1.4 Add a page-error/console-error collector attached via `page.on("pageerror", ...)` / `page.on("console", ...)` before the first navigation, storing any entries for a final assertion (design §"Goals", FR-E2E-001 second scenario)

## 2. Journey Step — Registration & Authentication

- [x] 2.1 Register a new account through `/register` (RegisterPage) using the generated credentials; assert redirect to `/` (notes list) — FR-AUTH-001
- [x] 2.2 Log out immediately via `NotesListHeader`'s "Log out" control; assert redirect to `/login` — FR-AUTH-004
- [x] 2.3 Log back in through `/login` (LoginPage) with the same credentials; assert redirect to `/`, and capture the returned access token for the API helpers from task group 1 — FR-AUTH-002, FR-AUTH-003

## 3. Journey Step — Note Creation & Editing

- [x] 3.1 Click "New Note", wait for the auto-create redirect from `/notes/new` to `/notes/:id` (per design §"Risks" — auto-create-on-mount) — FR-NOTE-001
- [x] 3.2 Set the note title (`aria-label="Note title"` input) and type rich-text content into the TipTap editor; wait for the autosave "Saved" status text before proceeding — FR-NOTE-003, FR-UI-EDITOR-001, FR-UI-EDITOR-002

## 4. Journey Step — Tagging

- [x] 4.1 Create a tag via the API helper from task 1.2, using the captured access token — FR-TAG-001
- [x] 4.2 In the open note editor, use `TagPicker` to check the new tag's label; wait for the autosave "Saved" status text — FR-UI-EDITOR-001
- [x] 4.3 Navigate to the notes list (`/`), use `TagFilterControls` to check the same tag's label, and assert the note appears in the filtered results — FR-NOTE-008, FR-UI-NOTES-001

## 5. Journey Step — Search

- [x] 5.1 Navigate to `/search`, submit a keyword that matches the note's title or content, and assert the note appears in results with highlighted match text (`<mark>` content) — FR-SEARCH-001, FR-SEARCH-002, FR-UI-SEARCH-001

## 6. Journey Step — Sharing

- [x] 6.1 Open the note, use `ShareModal` to generate a share link with the default expiration, and assert the link, `Expires`, and `Views: 0` are displayed — FR-SHARE-001, FR-UI-SHARE-001
- [x] 6.2 Extract the token from the displayed link (helper from 1.3) and call `GET /api/share/:token` unauthenticated via the API request helper; assert `200 OK` and that the returned `title`/`content` match the note — FR-SHARE-001, FR-SHARE-004 (view count increments)

## 7. Journey Step — Version History

- [x] 7.1 Open `VersionHistoryDrawer` (the edit from task 3.2 already produced version 2), select version 1, assert the preview shows the original ("Untitled", empty) content, click "Restore version 1", and assert the editor content reverts to the original and the drawer closes — FR-VER-002, FR-VER-003, FR-VER-004, FR-UI-VER-001, FR-UI-VER-002

## 8. Journey Step — Logout & Error-Free Assertion

- [x] 8.1 Log out via `NotesListHeader`; assert redirect to `/login` — FR-AUTH-004
- [x] 8.2 After the full run completes, assert the page-error/console-error collector from task 1.4 recorded zero entries — FR-E2E-001 (second scenario)

## 9. Environment Prerequisites

- [x] 9.1 Add a short header comment at the top of `frontend/e2e/journey.spec.ts` documenting the required local setup (`NODE_ENV=test` backend against `TEST_DATABASE_URL`, `WEB_ORIGIN=http://localhost:4173`) per design §"Environment prerequisites" — comment only, no other doc changes

## 10. Quality Gates & Manual Verification

- [x] 10.1 Run `pnpm --filter frontend build` — must finish with 0 errors, 0 warnings
- [x] 10.2 Run `pnpm --filter frontend lint --max-warnings 0` — must pass cleanly
- [x] 10.3 Run `pnpm --filter frontend test:e2e` with both Postgres containers and the backend (`NODE_ENV=test`, correct `WEB_ORIGIN`) running; confirm `journey.spec.ts` and the untouched `smoke.spec.ts` both pass
- [x] 10.4 Run the root quality-gate sequence `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` per AGENTS.md §4.3
- [x] 10.5 Manually smoke-test the full happy path once in headed/non-headless mode per NFR-003, confirming no visual regressions the automated assertions might not catch
