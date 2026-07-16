# backend/CLAUDE.md

Backend-specific development rules for `backend/` (Express 5, TypeScript, Prisma, PostgreSQL 16). Supplements the root `CLAUDE.md` and `AGENTS.md` — read those first; this file adds only backend-specific detail and does not repeat them.

## Backend Commands

* `pnpm --filter backend dev` — start the API server in watch mode.
* `pnpm --filter backend build` — compile TypeScript; zero errors/warnings required.
* `pnpm --filter backend lint` — ESLint; zero warnings required.
* `pnpm --filter backend test` — Vitest + Supertest integration tests, run against `notes_test` (port 5433).
* `npx prisma migrate dev` — create/apply a migration; applied against both `DATABASE_URL` and `TEST_DATABASE_URL` (as defined in AGENTS.md dual-database migrations).
* `npx prisma generate` — regenerate the Prisma Client after any schema change.
* `npx prisma studio` — local data inspection only; never point at `notes_test` while the test suite is running.
* `docker compose up notes_dev notes_test` — start both isolated Postgres containers.

## Express 5 + TypeScript Patterns

* Wire middleware in exactly the order documented in AGENTS.md — `helmet` → `cors` → `express.json` → `cookieParser` → `requestLogger` → rate limiters → `authenticateToken` → routes → global error handler. Never reorder.
* Keep route handlers thin: parse/validate input, call a service function, return the response. Business logic and Prisma queries live in the service layer, not in route handlers.
* Validate every request body/query with the matching Zod schema imported from `packages/shared` — never redefine validation inline in the backend.
* Express 5 forwards rejected promises from async route handlers to the error middleware automatically — don't wrap handlers in manual `try/catch`-to-`next()` boilerplate.
* Every error surfaced to a client must resolve to the standard `{ code, message, fields? }` shape (the standard API error format defined in AGENTS.md) via the global error handler — no ad hoc error payloads from individual routes.
* Never import Prisma Client directly into a route file; go through a service/repository module so query logic stays isolated and testable.
* One Express `Router` per domain (`auth`, `notes`, `tags`, `search`, `share`, `versions`), mounted under `/api/<domain>` — no cross-domain logic inside a single router file.
