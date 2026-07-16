# frontend/CLAUDE.md

Frontend-specific development rules for `frontend/` (React 19, Vite, TanStack Query, Zustand, TipTap, TailwindCSS, Playwright). Supplements the root `CLAUDE.md` and `AGENTS.md` — read those first; this file adds only frontend-specific detail and does not repeat them.

## Frontend Commands

* `pnpm --filter frontend dev` — start the Vite dev server.
* `pnpm --filter frontend build` — production build; zero errors/warnings required.
* `pnpm --filter frontend lint` — ESLint; zero warnings required.
* `pnpm --filter frontend test` — Vitest + React Testing Library component tests, with API calls mocked via MSW.
* `pnpm --filter frontend test:e2e` — Playwright browser E2E suite; requires the backend and both Postgres containers running.
* `pnpm --filter frontend preview` — serve the production build locally for manual smoke testing.

## React 19 / TanStack Query / Zustand / TipTap Patterns

* Use TanStack Query exclusively for server state — notes list, tags, search results, and all mutations. Never mirror server data inside a Zustand store.
* Zustand holds only client-only UI state: `AuthStore` (token/user), `NoteStore` (open note id/draft), `EditorStore` (editor instance, autosave/retry state) — per AGENTS.md.
* After a mutation, invalidate the correct query cache keys (e.g. updating a note invalidates both its detail key and the paginated notes-list key) rather than manually overwriting cached data.
* Import all request/response types from `packages/shared` — never redeclare API DTO shapes locally in frontend code.
* Render TipTap/user-generated rich content only after sanitizing with DOMPurify; never use `dangerouslySetInnerHTML` on unsanitized content.
* Keep the access token in memory only (`AuthStore`) — never in `localStorage`/`sessionStorage`. The refresh token lives solely in the backend-set HTTP-only cookie.
* Autosave triggers after exactly 2 seconds of editor inactivity and follows the defined retry strategy (1s → 2s → 4s), as documented in AGENTS.md and the SDS. Show retry state quietly and surface an error only after all retries are exhausted.
— show retry state quietly, surface failure only once retries are exhausted.
* Use function components with hooks throughout; no class components.
* Keep components focused and reusable. Business logic belongs in hooks or service layers, not inside presentation components.
