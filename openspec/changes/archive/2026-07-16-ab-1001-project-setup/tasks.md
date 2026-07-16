## 1. Root Workspace & Tooling Bootstrap

- [x] 1.1 Create root `package.json` (private, `"type": "module"`) with workspace-aware scripts: `build` → `pnpm -r run build`, `lint` → `pnpm -r run lint`, `test` → `pnpm -r run test`, run as three separate gate commands per AGENTS.md §4.3. [monorepo-foundation; FR-INFRA-001]
- [x] 1.2 Create root `pnpm-workspace.yaml` listing `backend`, `frontend`, `packages/shared`. [monorepo-foundation; FR-INFRA-001]
- [x] 1.3 Create root `tsconfig.base.json` (strict mode, target/module settings) for all three workspace `tsconfig.json` files to extend. [monorepo-foundation]
- [x] 1.4 Create root `docker-compose.yml` defining `notes_dev` (5432) and `notes_test` (5433) Postgres 16 services exactly per SDS §12. [monorepo-foundation]
- [x] 1.5 Create `.env.example` covering every variable in SDS §8; update `.gitignore` for `node_modules`, `dist`, `.env`, coverage output. **Deviation:** placed at `backend/.env.example` (not repo root) since only the backend consumes these variables, and Node's `--env-file`/Prisma's auto-loading both resolve `.env` relative to `backend/` (cwd for backend scripts), not the repo root. [monorepo-foundation]

## 2. Quality Tooling (Lint, Format, Git Hooks, Commit Standards)

- [x] 2.1 Create root `eslint.config.js` (ESLint 9/10 flat config) with a shared base plus override blocks for backend (Node/TS), frontend (React/TS/JSX), and shared (TS-only). [quality-tooling; FR-INFRA-003]
- [x] 2.2 Create root `.prettierrc.json` and `.prettierignore`. [quality-tooling; FR-INFRA-003]
- [x] 2.3 Install and initialize Husky; add `.husky/pre-commit` running `pnpm exec lint-staged`. [quality-tooling; FR-INFRA-003]
- [x] 2.4 Add `lint-staged` configuration running `eslint --fix`, `prettier --write`, and the relevant workspace's `tsc --noEmit` against staged files. [quality-tooling; FR-INFRA-003]
- [x] 2.5 Install and configure commitlint: `commitlint.config.cjs` extending `@commitlint/config-conventional` plus the custom rule (design Decision 10) enforcing an `AB-####`/`AB#####` reference on `feat`/`fix` commits; add `.husky/commit-msg` running `commitlint --edit`. [quality-tooling; FR-INFRA-004]
- [x] 2.6 Manually verified: a commit with a lint failure is blocked by pre-commit (reproduced with a real unused-variable violation in `backend/src/server.ts`, confirmed lint-staged rejects and auto-reverts); a `feat` commit without an `AB-` reference is rejected by commit-msg; an invalid-format message is rejected; a valid `feat(...): ... AB#1001` commit succeeds (all three exercised directly against `.husky/commit-msg`). [quality-tooling]

## 3. `packages/shared` Skeleton

- [x] 3.1 Create `packages/shared/package.json` (name `@take-note/shared`, `"type": "module"`, `main`/`types`/`exports` pointing at `dist/`, `build` script via `tsc --project tsconfig.build.json`). Pinned via npm registry lookup at implementation time: `zod@4.4.3`, `typescript@6.0.3` (see Group 4 note on the TypeScript version choice). [monorepo-foundation; FR-INFRA-002]
- [x] 3.2 Create `packages/shared/tsconfig.json` and `tsconfig.build.json`, both extending the root base config.
- [x] 3.3 Create `packages/shared/src/index.ts` as a minimal barrel placeholder (`SHARED_PACKAGE_NAME` constant — no DTOs yet).
- [x] 3.4 Add `packages/shared` Vitest config and one minimal smoke test asserting the barrel module imports without error. [testing-foundation]
- [x] 3.5 Verified: `pnpm --filter shared build && pnpm --filter shared lint --max-warnings 0 && pnpm --filter shared test` all pass.

## 4. Backend Skeleton (Express App + Middleware)

- [x] 4.1 Create `backend/package.json` with pinned dependencies and `"@take-note/shared": "workspace:*"`. **Version-compatibility findings during implementation (confirmed with the user):** TypeScript's newest release (`7.0.2`) is not yet supported by `typescript-eslint` (peer range `>=4.8.4 <6.1.0`), so TypeScript is pinned to `6.0.3` (the newest version within that supported range) across all workspaces. Prisma 7 (latest) requires a config-file-based datasource and drops automatic `.env` loading, conflicting with SDS §2's literal schema pattern and this ticket's approved dual-migration script design — pinned to `prisma@6.19.3`/`@prisma/client@6.19.3` instead, per explicit user confirmation. [monorepo-foundation; FR-INFRA-002]
- [x] 4.2 Create `backend/tsconfig.json` (+ `tsconfig.build.json`, mirroring the shared package's split so ESLint's type-aware linting can see config/test files while the build output excludes them) extending the root base config with `NodeNext` module resolution.
- [x] 4.3 Implement `backend/src/app.ts` wiring `helmet → cors → express.json → cookieParser → requestLogger (pino-http) → rate limiter → GET /api/health → notFoundHandler → errorHandler`, per AGENTS.md §5 / SDS §1.1 / design Decision 3, with a code comment marking exactly where `authenticateToken` and domain routers are inserted by AB-1002+. Added `notFoundHandler` (routes unmatched requests into the standard error shape) since the error handler needs something upstream to trigger it for undefined routes.
- [x] 4.4 Implement `backend/src/middleware/errorHandler.ts` returning the standard `{ code, message, fields? }` shape (AGENTS.md §8).
- [x] 4.5 Implement `backend/src/server.ts` bootstrapping `app.listen(PORT)`.
- [x] 4.6 Add backend scripts: `dev` (`tsx watch --env-file=.env src/server.ts`), `build` (`tsc --project tsconfig.build.json`), `start` (`node --env-file=.env dist/server.js`), `lint` (`eslint . --max-warnings 0`).

## 5. Prisma Schema & Dual-Database Migration

- [x] 5.1 Create `backend/prisma/schema.prisma` with exactly the seven models from SDS §2, on Prisma 6.19.3 (see Group 4 note), excluding the `tsvector`/GIN column and the case-insensitive `Tag(name)` functional index (design Decision 1 — deferred to AB-1007/AB-1006). [database-foundation]
- [x] 5.2 Create `backend/scripts/migrate-all.mjs` implementing the dual-database migration flow (design Decision 2). [database-foundation]
- [x] 5.3 Add backend scripts `db:migrate` (invokes `migrate-all.mjs`) and `db:generate` (`prisma generate`).
- [x] 5.4 With `docker compose up -d notes_dev notes_test` running, executed `node scripts/migrate-all.mjs init` — the initial migration applied cleanly to both `notes_dev` and `notes_test`, and `prisma generate` succeeded. [database-foundation]

## 6. Backend Testing Foundation

- [x] 6.1 Add `backend/vitest.config.ts` — loads `backend/.env` via Node 22's `process.loadEnvFile`, forces `DATABASE_URL` to `TEST_DATABASE_URL`'s value for the test run, `@vitest/coverage-v8` configured excluding `server.ts` from coverage per design Decision 7. [testing-foundation]
- [x] 6.2 Wrote `backend/src/app.test.ts`: "GET /api/health > returns 200 with a status ok payload" (Supertest) and "notes_test database connectivity > connects to notes_test and executes a trivial query" (`SELECT 1` via the Prisma client singleton at `backend/src/lib/prisma.ts`). Both pass against the real `notes_test` container. [testing-foundation]
- [x] 6.3 Quality gate checkpoint: `pnpm --filter backend build && pnpm --filter backend lint --max-warnings 0 && pnpm --filter backend test` all pass.

## 7. Frontend Skeleton (React + Vite + Tailwind)

- [x] 7.1 Create `frontend/package.json` with pinned dependencies and `"@take-note/shared": "workspace:*"`. **Deviation:** Tailwind CSS v4 (latest, `4.3.3`) replaces the classic PostCSS-plugin setup with the `@tailwindcss/vite` plugin — `postcss`/`autoprefixer` are not needed and were dropped. Verified via context7 that `@vitejs/plugin-react@6.0.3` peer-requires `vite@^8.0.0` (matches pinned `vite@8.1.5`) and TipTap 3.x supports React 19. [monorepo-foundation; FR-INFRA-002]
- [x] 7.2 Create `frontend/tsconfig.json` + split `tsconfig.app.json`/`tsconfig.node.json` (standard Vite project-references pattern), `vite.config.ts` (with the `@tailwindcss/vite` plugin). **Deviation:** no `tailwind.config.ts`/`postcss.config.js` — see 7.1.
- [x] 7.3 Implement `frontend/index.html`, minimal `src/main.tsx`, `App.tsx` (app shell with a visible "Take Note" heading), and `src/index.css` (`@import "tailwindcss";`, the v4 syntax).
- [x] 7.4 Add frontend scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `lint` (`eslint . --max-warnings 0`).

## 8. Frontend Testing Foundation

- [x] 8.1 Add `frontend/vitest.config.ts` (jsdom environment, RTL setup file at `src/test/setup.ts`, MSW server/handlers at `src/test/mocks/`), coverage excluding `main.tsx` and `test/**` per design Decision 7.
- [x] 8.2 Wrote `frontend/src/App.test.tsx`: "App shell > renders the application heading" — passes.
- [x] 8.3 Quality gate checkpoint: `pnpm --filter frontend build && pnpm --filter frontend lint --max-warnings 0 && pnpm --filter frontend test` all pass.

## 9. Playwright E2E Foundation

- [x] 9.1 Add `frontend/playwright.config.ts` — `webServer` runs `pnpm run build && pnpm run preview` and waits on port 4173 (design Decision 8 — no backend/DB dependency).
- [x] 9.2 Wrote `frontend/e2e/smoke.spec.ts`: "app shell renders" — passes standalone.
- [x] 9.3 Added frontend `test:e2e` script; verified it passes standalone (no Docker/backend required).

## 10. Full Monorepo Verification & Manual Smoke Test

- [x] 10.1 From the repo root: `pnpm build` → `pnpm lint` → `pnpm test` all pass, in that order, with zero build/lint errors. Root `test` script was extended to `pnpm -r run test && pnpm --filter frontend run test:e2e` so the root command covers unit, integration, and E2E per AGENTS.md §4's definition of `pnpm test`, while `frontend/CLAUDE.md`'s `test` vs `test:e2e` per-workspace distinction is preserved.
- [x] 10.2 Manually smoke tested against a real running dev server (not just the test harness): `docker compose up` (both containers healthy), `node scripts/migrate-all.mjs init` (applied to both DBs), started `pnpm dev`, confirmed `GET /api/health` → `200 {"status":"ok"}` and an undefined route → `404 {"code":"NOT_FOUND","message":"..."}` via curl. (Two local-environment blockers were hit and resolved along the way: Docker Desktop needed starting, and a stale port-5433 conflict from an unrelated container required cleanup — both confirmed with the user before acting.)
- [x] 10.3 Scenario-to-test/manual-check traceability confirmed — see mapping below.

---

### Scenario traceability (task 10.3)

**monorepo-foundation:**

- "Developer installs the project from the repository root" — manual (`pnpm install` succeeded for all 3 workspaces during implementation).
- "Frontend and backend require the same type or validation schema" — partially demonstrated: both `backend/package.json` and `frontend/package.json` declare `"@take-note/shared": "workspace:*"` and pnpm links it correctly (proven by `packages/shared` building before backend/frontend consume it); no actual shared DTO exists yet since none is needed until AB-1002+, so full enforcement of this rule will be demonstrated then.
- "Dependency versions are inspected" — manual (every workspace `package.json` reviewed; all exact pins, no `^`/`~`/`@latest`).
- "An alternative framework or database is proposed" — policy statement, not a runtime check.
- "Developer starts local database services" — manual (`docker compose up -d notes_dev notes_test`, both reported healthy).
- "Developer configures a local environment" — manual (`backend/.env.example` reviewed against SDS §8).

**database-foundation:**

- "Prisma schema is inspected" — manual (schema.prisma reviewed against SDS §2).
- "Prisma Client is generated" — automated, via `backend/src/app.test.ts` > "notes_test database connectivity > connects to notes_test and executes a trivial query" (requires a successfully generated client).
- "Initial migration is applied" — manual (`node scripts/migrate-all.mjs init` run against both databases, output confirmed).
- "Schema indexes are inspected" — manual (generated `migration.sql` reviewed for the documented base indexes).

**quality-tooling:**

- "Linting completes with no issues" / "Linting produces a warning" — enforced by the `--max-warnings 0` flag baked into every workspace's `lint` script; demonstrated passing in 10.1.
- "Code formatting is checked" — manual (Prettier config present, applied via lint-staged).
- "Developer attempts to commit code with a failing required quality check" — manual, reproduced live (see 2.6).
- "Developer creates a valid ticket-linked feature commit" / "invalid commit message" / "missing ticket reference" — manual, reproduced live against `.husky/commit-msg` (see 2.6).

**testing-foundation:**

- "Developer runs the backend test command" — automated: `backend/src/app.test.ts` (2 tests).
- "Developer runs the frontend test command" — automated: `frontend/src/App.test.tsx` (1 test).
- "End-to-end smoke test is invoked" — automated: `frontend/e2e/smoke.spec.ts` (1 test).
- "Developer runs the project test command from the repository root" — automated/manual gate: root `pnpm test` runs all of the above successfully (see 10.1).

---

**Delegation & parallelization notes** (AGENTS.md §4.5 / FR-INFRA-006):

- Task groups **4–6 (backend + Prisma + backend tests)** and **7–9 (frontend + frontend tests + Playwright)** are independent once group 3 (`packages/shared`) is complete, and SHALL be executed in separate Git worktrees if run in parallel, per the "frontend and backend parallel development SHALL use separate worktrees" rule. (Executed sequentially in this session rather than in parallel worktrees, since the per-file `[y/n]` approval requirement made worktree-based parallel delegation impractical to coordinate.)
- Groups **4–6** and **7–9** were each estimated to exceed 45 minutes of implementation work end-to-end and were candidates for subagent delegation; implemented directly instead for the same reason as above.
- Group **2** (quality tooling) had no code dependency on groups 3–9.
- Group **10** ran last, after every other group completed and passed its own quality-gate checkpoint.
