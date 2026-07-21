## ADDED Requirements

### Requirement: Automated Unit and Integration Test Execution

The project SHALL provide automated unit and integration testing support for both `backend/` (Vitest + Supertest) and `frontend/` (Vitest + React Testing Library + MSW), executable through documented project commands.

#### Scenario: Developer runs the backend test command

- **WHEN** a developer runs `pnpm --filter backend test`
- **THEN** the configured Vitest + Supertest smoke test executes successfully against the `notes_test` database

#### Scenario: Developer runs the frontend test command

- **WHEN** a developer runs `pnpm --filter frontend test`
- **THEN** the configured Vitest + React Testing Library smoke test executes successfully

### Requirement: Browser-Based End-to-End Testing Support

The project SHALL provide browser-based end-to-end testing support via Playwright, executable through a documented project command, proven by a minimal smoke test that does not depend on the backend or database being available.

#### Scenario: End-to-end smoke test is invoked

- **WHEN** a developer runs `pnpm --filter frontend test:e2e`
- **THEN** Playwright starts the frontend preview server and confirms the application shell renders successfully

### Requirement: Root Test Command Runs All Suites

The project SHALL provide a root-level test command that executes the configured automated tests across all workspaces.

#### Scenario: Developer runs the project test command from the repository root

- **WHEN** a developer runs `pnpm test` from the repository root
- **THEN** the backend, frontend, and shared workspaces' configured automated tests all execute successfully
