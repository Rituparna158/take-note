## Why

The repository currently contains only documentation (`AGENTS.md`, `CLAUDE.md`, `docs/FRS.md`, `docs/SDS.md`) and the AI development context (`.claude/agents`, `.claude/commands`, `.claude/skills`) — there is no installable monorepo, no database schema, no lint/format/commit tooling, and no test runner configured. AB-1001 is the mandatory first ticket in the FRS §18 sequence, and every later ticket (AB-1002 onward) depends on a working `pnpm` workspace, a generated Prisma Client against the full schema, and passing `pnpm build` / `pnpm lint` / `pnpm test` quality gates. This change establishes that foundation so subsequent tickets can be implemented without redoing infrastructure work.

## What Changes

- Initialize a `pnpm` workspace monorepo with `backend/`, `frontend/`, and `packages/shared/` as workspace packages, per FR-INFRA-001.
- Scaffold `backend/` with Express 5, TypeScript (strict), and the middleware pipeline order fixed in AGENTS.md/SDS §1.1 (empty domain routers may be stubbed; feature logic is out of scope and lands in later tickets).
- Scaffold `frontend/` with React 19 + Vite, TailwindCSS, and base app shell (feature UI is out of scope; lands in AB-1010+).
- Scaffold `packages/shared/` as a framework-agnostic Zod/TypeScript package consumed by both workspaces.
- Add the full Prisma schema from SDS §2 (`User`, `RefreshToken`, `Note`, `Tag`, `NoteTag`, `ShareLink`, `NoteVersion`) with one initial migration applied to both `notes_dev` and `notes_test` (SDS §2.2 dual-database migrations), plus the `docker-compose.yml` defining both isolated Postgres services (SDS §12).
- Pin all mandated dependency versions (Node 22, Express 5, React 19, Prisma, PostgreSQL 16 client, TypeScript, etc.) — no `@latest`, no substitutions, per FR-INFRA-002.
- Add ESLint + Prettier shared config across all three workspaces, and Husky + lint-staged (`pre-commit`) + commitlint (`commit-msg`) git hooks, per FR-INFRA-003 and FR-INFRA-004.
- Add automated testing tooling: Vitest + Supertest for `backend/`, Vitest + React Testing Library + MSW for `frontend/`, Playwright for E2E — each with exactly one minimal smoke test proving the harness executes successfully (FR-INFRA-005). Feature-level test coverage is out of scope and lands with each feature ticket.
- Add root `.env.example` covering the variables listed in SDS §8.

Out of scope for this change (explicitly deferred to later tickets per FRS §18): authentication, notes/tags/search/share/version business logic and their routes/services, and any frontend feature pages.

## Capabilities

### New Capabilities

- `monorepo-foundation`: pnpm workspace structure, backend/frontend/shared scaffolding, pinned dependency versions, Docker Compose for the two Postgres services, and environment configuration (FR-INFRA-001, FR-INFRA-002).
- `database-foundation`: the full Prisma schema (SDS §2) and dual-database migration setup supporting every later feature ticket.
- `quality-tooling`: ESLint/Prettier configuration, Husky + lint-staged pre-commit hook, and commitlint commit-msg hook enforcing Conventional Commits + Azure Boards references (FR-INFRA-003, FR-INFRA-004).
- `testing-foundation`: Vitest/Supertest (backend), Vitest/RTL/MSW (frontend), and Playwright (E2E) configured and each proven with one minimal smoke test (FR-INFRA-005).

### Modified Capabilities

None — no existing specs to modify; this is the first change in the project.

## Impact

- **New code**: root `package.json`/`pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`; `backend/` Express app skeleton + Prisma schema/migrations; `frontend/` Vite/React app skeleton; `packages/shared/` package skeleton; ESLint/Prettier configs; Husky hooks (`.husky/pre-commit`, `.husky/commit-msg`); `commitlint.config.*`; Vitest/Playwright configs and one smoke test per runner.
- **Dependencies**: introduces all pinned dependencies listed in AGENTS.md §3 across the three workspaces.
- **Systems**: requires Docker (or equivalent) to run the two PostgreSQL 16 containers (`notes_dev` on 5432, `notes_test` on 5433) used by backend dev and test runs.
- **No behavior change for end users** — this ticket produces no user-facing functionality; it is purely developer/CI-facing infrastructure that later tickets build on.
