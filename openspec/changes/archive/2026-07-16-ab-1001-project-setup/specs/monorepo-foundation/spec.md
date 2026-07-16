## ADDED Requirements

### Requirement: Monorepo Workspace Structure

The project SHALL use a single `pnpm`-workspace-based monorepo containing separate `backend/`, `frontend/`, and `packages/shared/` workspaces, installable from the repository root.

#### Scenario: Developer installs the project from the repository root

- **WHEN** a developer runs the install command from the repository root
- **THEN** dependencies for `backend/`, `frontend/`, and `packages/shared/` are installed successfully

#### Scenario: Frontend and backend require the same type or validation schema

- **WHEN** both `frontend/` and `backend/` need the same DTO type or Zod validation schema
- **THEN** both workspaces consume that definition from `packages/shared` rather than redeclaring it

### Requirement: Pinned Dependency Versions

Tool and dependency versions across all workspaces SHALL be pinned to exact versions. Floating `@latest` installs and unpinned semver ranges MUST NOT be used, and no technology substitutions for the mandated stack (Express 5, Node 22, React 19, Prisma, PostgreSQL 16, TipTap, TailwindCSS, TanStack Query, Zustand, Vitest, Supertest, Playwright) SHALL be introduced.

#### Scenario: Dependency versions are inspected

- **WHEN** any workspace's `package.json` is inspected
- **THEN** dependency versions are pinned exact versions rather than installed using `@latest` or floating ranges

#### Scenario: An alternative framework or database is proposed

- **WHEN** a substitution for a mandated technology (e.g. a different backend framework or database engine) is proposed
- **THEN** the substitution is rejected

### Requirement: Local PostgreSQL Services via Docker Compose

The project SHALL provide a Docker Compose configuration that starts two isolated PostgreSQL 16 services — `notes_dev` on port 5432 and `notes_test` on port 5433 — for local development and automated testing.

#### Scenario: Developer starts local database services

- **WHEN** a developer runs `docker compose up notes_dev notes_test`
- **THEN** both PostgreSQL containers start and report healthy on their configured ports

### Requirement: Environment Configuration Template

The project SHALL provide a root `.env.example` file documenting every environment variable required to run the application, matching the variable set defined in `docs/SDS.md` §8.

#### Scenario: Developer configures a local environment

- **WHEN** a developer copies `.env.example` to `.env`
- **THEN** every variable required by the backend (server config, both database URLs, JWT secret, purge cron schedule) is present with a documented example value
