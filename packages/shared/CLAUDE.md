# packages/shared/CLAUDE.md

Shared-package development rules for `packages/shared/` (Zod schemas, TypeScript types, validation rules consumed by both `backend/` and `frontend/`). Supplements the root `CLAUDE.md` and `AGENTS.md` — read those first; this file adds only shared-package-specific detail and does not repeat them.

## Shared Package Commands

* `pnpm --filter shared build` — compile the package so `backend/` and `frontend/` can consume its output.
* `pnpm --filter shared lint` — ESLint; zero warnings required.
* `pnpm --filter shared test` — unit tests for validation schemas and type guards.

## Type-Sharing & No-Duplication Patterns

* Before adding any new type or Zod schema, search `packages/shared` for an existing equivalent and reuse it — do not create a near-duplicate in another workspace, as defined in AGENTS.md.
* Any DTO, request/response shape, or validation rule used by more than one workspace is defined here exactly once; `backend/` and `frontend/` both import it, neither redeclares it locally.
* Zod schemas are the single source of both runtime validation and inferred TypeScript types (`z.infer<...>`) — never hand-write a parallel `interface`/`type` for a schema that already exists here.
* This package stays framework-agnostic: no Express types, no React imports, no Prisma Client types. Anything backend-only or frontend-only belongs in that workspace, not here.
* Before changing a shared schema's shape, check its callers in both `backend/` and `frontend/` — a field change here affects both consumers simultaneously.
* The same strict type-safety rule as the rest of the monorepo applies here — `any` MUST NOT be used to bypass type safety, as defined in AGENTS.md.
