## Context

The repository currently has only documentation and AI-development context (`AGENTS.md`, `CLAUDE.md` files, `docs/FRS.md`, `docs/SDS.md`, `.claude/agents`, `.claude/commands`, `.claude/skills`). There is no `package.json`, no workspace config, no Prisma schema, no lint/format/git-hook tooling, and no test runner anywhere in the tree (confirmed by inspection: `backend/`, `frontend/`, `packages/shared/` each contain only their `CLAUDE.md`). AB-1001 is the mandatory first ticket (FRS §18); every later ticket depends on this foundation existing and passing `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`.

This design covers only the approved proposal scope: `monorepo-foundation`, `database-foundation`, `quality-tooling`, `testing-foundation`. It does not cover any feature logic (auth, notes, tags, search, share, versions, or any frontend feature UI) — those remain scoped to their own tickets per FRS §18.

## Goals / Non-Goals

**Goals:**

- A working `pnpm` workspace with `backend/`, `frontend/`, `packages/shared/` installable from the repo root (FR-INFRA-001).
- Pinned, non-`@latest` dependency versions across all three workspaces (FR-INFRA-002).
- The full Prisma schema from SDS §2 (all 7 models) with one initial migration applied to both `notes_dev` and `notes_test` (SDS §2.2).
- ESLint + Prettier + Husky/lint-staged (pre-commit) + commitlint (commit-msg) enforcing zero-warning lint and Conventional-Commits-with-ticket-reference (FR-INFRA-003, FR-INFRA-004).
- Vitest+Supertest (backend), Vitest+RTL+MSW (frontend), and Playwright (E2E) each configured and proven with exactly one minimal smoke test (FR-INFRA-005).
- The strict Express middleware order (AGENTS.md §5 / SDS §1.1) established in a runnable `backend` skeleton, with a documented insertion point for `authenticateToken` and domain routers that AB-1002+ will add.

**Non-Goals:**

- No authentication, notes, tags, search, sharing, or version-history logic, routes, or DTOs — those are later tickets' scope.
- No CI pipeline (confirmed out of scope in the approved proposal).
- No additional MCP integration (context7 already satisfies the ticket's "MCPs" item).
- No frontend feature pages/routes beyond the minimal app shell needed for the smoke test.
- No generated `tsvector`/GIN full-text-search column or the case-insensitive `Tag(name)` functional index — see Decisions below.

## Decisions

**1. Prisma schema scope: exactly the SDS §2 model block, nothing from §4/§6.1.**
SDS §2's Prisma schema (the 7 models) is added verbatim in this ticket. The generated `tsvector` column + GIN index (SDS §4, §6.1) and the case-insensitive functional index on `Tag(name, userId)` (SDS §6.1) are raw-SQL migrations that exist only to support full-text search (AB-1007) and tag case-insensitive uniqueness (AB-1006) — features not yet implemented. Adding them now would create unused DB objects ahead of the code that needs them and would blur ticket boundaries. They will be added as their own `--create-only` raw-SQL migrations by AB-1007 and AB-1006 respectively, per SDS §7. _Alternative considered_: add all indexes now since SDS already fully specifies them — rejected because it front-loads work into AB-1001 that the mandatory sequence (FRS §18) assigns to later tickets, and an index with no querying code yet is untestable in this ticket.

**2. Dual-database migration via a small Node script, not manual dual commands.**
`backend/prisma/schema.prisma` uses `env("DATABASE_URL")`. A `backend/scripts/migrate-all.mjs` script runs `prisma migrate dev --name <n>` once against `DATABASE_URL` (generates the migration files), then re-invokes `prisma migrate deploy` with `DATABASE_URL` temporarily overridden to `process.env.TEST_DATABASE_URL` in the child process env, applying the _same_ migration files to `notes_test` per SDS §2.2. Exposed as `pnpm --filter backend db:migrate`. _Alternative considered_: document two manual CLI invocations — rejected, error-prone and easy to let the two databases drift.

**3. `authenticateToken` and domain routers are not stubbed.**
The Express middleware chain (helmet → cors → express.json → cookieParser → requestLogger → rate limiters → authenticateToken → routes → error handler) is wired in `backend/src/app.ts` up through rate limiters. `authenticateToken` doesn't exist until AB-1002 implements JWT verification, so it is not faked with a no-op — a fake auth middleware would contradict NFR-004 and could be mistaken for real behavior. Instead, `app.ts` mounts one infrastructure-only route, `GET /api/health` (unauthenticated, returns `{ status: "ok" }`), directly after the rate limiter, with a code comment marking exactly where `authenticateToken` and `/api/*` domain routers are inserted next. The global error handler (`backend/src/middleware/errorHandler.ts`) is implemented now, returning the standard `{ code, message, fields? }` shape (AGENTS.md §8), since every later ticket's errors flow through it.

**4. Package manager & module system: pnpm workspaces, ESM everywhere, no extra build orchestrator.**
Root `pnpm-workspace.yaml` lists `backend`, `frontend`, `packages/shared`. All three workspaces use `"type": "module"`. No Turborepo/Nx — `pnpm -r` already runs scripts in dependency-topological order (so `packages/shared` builds before `backend`/`frontend`, which declare it as `"@take-note/shared": "workspace:*"`), which is sufficient at this project's size. Root `package.json` scripts: `build` → `pnpm -r run build`, `lint` → `pnpm -r run lint`, `test` → `pnpm -r run test`, matching the mandatory gate order (AGENTS.md §4.3) run as three separate top-level commands, never combined into one script, so a failure halts before the next gate.

**5. `packages/shared` builds with plain `tsc`, not a bundler.**
It contains only Zod schemas and inferred types — no bundling, tree-shaking, or JSX involved — so `tsc --project tsconfig.build.json` emitting `dist/*.js` + `.d.ts` is sufficient and keeps the dependency list minimal. Package name: `@take-note/shared`.

**6. Backend env loading uses Node 22's native `--env-file`, not `dotenv`.**
`pnpm --filter backend dev` runs `tsx watch --env-file=.env src/server.ts`; the built artifact runs as `node --env-file=.env dist/server.js`. This avoids an extra runtime dependency now that Node 22 supports it natively. The Prisma CLI loads `.env` itself for `prisma migrate`/`prisma generate` invocations, so no additional wiring is needed there.

**7. Coverage tooling is configured now; the 80% bar applies to logic, not boilerplate.**
Vitest's `@vitest/coverage-v8` is configured in both `backend` and `frontend` with thresholds enabled, but pure wiring files with no branching logic (`server.ts`, `main.tsx`, generated Prisma client output, config files) are listed in `coverage.exclude` — consistent with standard practice of measuring coverage against testable logic. The only testable logic this ticket introduces (the health route handler, the error handler's shape-mapping) is covered by automated tests: the health route by the smoke test itself, and the error handler's shape-mapping (`AppError` with/without `fields`, generic `Error`, non-`Error` values) plus `notFoundHandler` by dedicated unit tests in `backend/src/middleware/errorHandler.test.ts`, with an end-to-end 404 case in `backend/src/app.test.ts`.

**8. Playwright smoke test only exercises the frontend shell — no backend/DB dependency.**
The AB-1001 Playwright test uses Playwright's `webServer` config to auto-start the Vite preview server and asserts the app shell renders (e.g., a visible root heading) — it does not call the backend. This keeps `pnpm test` runnable without Docker/Postgres for this ticket. The full authenticated, backend-integrated browser journey is explicitly AB-1016 scope (FR-E2E-001) and is not attempted here.

**9. ESLint uses one root flat config (ESLint 9 `eslint.config.js`), not per-workspace `.eslintrc` files.**
A single root config with per-workspace override blocks (backend: Node/TS rules; frontend: React/TS/JSX rules; shared: TS-only rules) keeps linting version and rule-set consistent across the monorepo (FR-INFRA-003's "consistent formatting" requirement) and avoids drift between three separate configs. Prettier: one root `.prettierrc.json` + `.prettierignore`.

**10. commitlint enforces the Azure Boards reference with a small custom rule, not config alone.**
`@commitlint/config-conventional` validates Conventional Commits structure, but it has no built-in concept of a ticket reference. `commitlint.config.cjs` adds a custom rule (a plugin function checking the raw message against `/AB[-#]\d+/i` whenever `type` is `feat` or `fix`) so FR-INFRA-004's "missing ticket reference is rejected" acceptance criterion is actually enforced, not just documented.

## Risks / Trade-offs

- **[Risk] Exact dependency patch/minor versions pinned during implementation may already be superseded by the time `/implement` runs (knowledge cutoff vs. current date).** → Mitigation: `/implement` verifies each package's latest stable version compatible with the mandated majors (Node 22, Express 5, React 19, Prisma, etc.) via `context7`/`npm view` before writing exact pinned versions into `package.json`; no `^`/`~` ranges are used (FR-INFRA-002).
- **[Risk] Deferring the `tsvector`/GIN and Tag case-insensitive indexes to AB-1006/AB-1007 means this ticket's schema is not the complete end-state schema shown piecemeal across the SDS.** → Mitigation: explicitly documented in Decision 1 and called out again at `/review` time so it isn't mistaken for an oversight; SDS §2's model block (the only schema shown as a single unit) is matched exactly.
- **[Risk] `pnpm -r` topological ordering silently relies on correct `workspace:*` dependency declarations; a missing dependency edge could build `backend`/`frontend` before `shared` changes land.** → Mitigation: `backend/package.json` and `frontend/package.json` explicitly declare `"@take-note/shared": "workspace:*"` as a dependency (not devDependency), which is what pnpm uses to compute build order.
- **[Risk] Husky/lint-staged/commitlint hooks are local-only; nothing currently enforces them outside a developer's machine (no CI, per approved proposal).** → Mitigation: accepted trade-off per the explicit "CI out of scope" decision; noted here so it isn't re-litigated later without a conscious decision to add CI in a future ticket.
- **[Risk] Native Node `--env-file` has stricter parsing than `dotenv` (no variable expansion/interpolation).** → Mitigation: `.env.example` uses only flat literal values (matches SDS §8 exactly, no interpolation needed).

## Migration Plan

This is new infrastructure with nothing currently deployed, so there is no live migration/rollback concern. Implementation proceeds in dependency order: `packages/shared` skeleton → root tooling (ESLint/Prettier/Husky/commitlint) → `backend` skeleton + Prisma schema/migration + backend tests → `frontend` skeleton + frontend tests → Playwright config/test → full `pnpm build && pnpm lint --max-warnings 0 && pnpm test` verification. Rollback, if needed before any commit, is simply discarding the working tree changes; once committed, a revert commit removes the same files.

## Open Questions

None outstanding — all ambiguities identified during `/spec` were resolved by the user's answers (full schema now, smoke tests included, no CI, context7 satisfies MCP scope) and are reflected in the Decisions above.
