# AGENTS.md

This file is the single source of truth for AI development context on the Note Taking App. It summarizes `docs/FRS.md` (functional requirements) and `docs/SDS.md` (technical design). When in doubt, those two documents are authoritative — this file is a derived summary, not a replacement.

## 1. Project Overview

The Note Taking Application provides authenticated users with a centralized system for creating, organizing, searching, and sharing personal notes. It supports rich-text editing, user-scoped tags, full-text search, public read-only sharing, and historical note versions. The project is built using a spec-driven development workflow: every ticket is specified, planned, decomposed, implemented, reviewed, and archived before a pull request is raised.

## 2. Repository Structure

```
your-repo/
├── backend/            ← Express 5, Node.js 22, TypeScript, Prisma Client, Vitest, Supertest
├── frontend/           ← React 19, Vite, TanStack Query, Zustand, TipTap, TailwindCSS, Playwright
├── packages/shared/    ← Common Zod schemas, TypeScript types, validation rules
├── docs/               ← FRS.md, SDS.md (source of truth)
└── openspec/           ← changes/ (active proposals), archive/ (completed proposals)
```

Managed as a single `pnpm` workspace-based monorepo (FR-INFRA-001).

## 3. Tech Stack

- **Backend**: Express 5, Node.js 22, TypeScript (strict), Prisma Client, PostgreSQL 16, Pino/Pino-http, `express-rate-limit`.
- **Frontend**: React 19, Vite, TanStack Query, Zustand, TipTap (rich-text editor), TailwindCSS, DOMPurify.
- **Shared**: Zod schemas and TypeScript types/DTOs, consumed by both frontend and backend.
- **Testing**: Vitest + Supertest (backend integration), Vitest + React Testing Library + MSW (frontend components), Playwright (E2E).
- **Tooling**: Husky + lint-staged (git hooks), commitlint (Conventional Commits + Azure Boards refs), OpenSpec (spec-driven workflow), `context7` MCP (live library docs lookup).
- Tool and dependency versions SHALL be pinned — no `@latest` installs, no technology substitutions.

## 4. Key Commands

Quality checks run in this exact order; any failure halts progress (§14.1 SDS):

1. `pnpm build` — must finish with 0 errors, 0 warnings.
2. `pnpm lint --max-warnings 0` — must pass cleanly.
3. `pnpm test` — all unit, integration, and E2E tests must pass.

Other commands:

- `npx prisma migrate dev` — apply schema migrations (run against both `notes_dev` and `notes_test` databases).
- `docker compose up` — start the two isolated PostgreSQL services (`notes_dev` on 5432, `notes_test` on 5433).
- `openspec archive AB-xxxx` — archive a completed ticket's spec proposal before raising a PR.

## 4.1 Development Workflow

The project follows a strict Spec-Driven Development (SDD) workflow. Every ticket SHALL complete the following lifecycle in order:

```
Spec (spec.md)
→ Plan (plan.md)
→ Tasks (tasks.md)
→ Implementation (with automated test-writer subagent)
→ Review (with automated reviewer subagent)
→ OpenSpec Archive (openspec/archive/)
→ Pull Request Preparation (/pr)
```

Implementation MUST NOT begin until the specification (`spec.md`), technical plan (`plan.md`), and task checklist (`tasks.md`) have all been reviewed and approved.

---

## 4.2 Mandatory Ticket Sequence

Tickets SHALL be implemented strictly in the order defined in **FRS Section 18**. Later tickets MUST NOT begin until the preceding ticket satisfies the project's Definition of Done.

```
AB-1001 → Project Foundation
AB-1002 → Authentication
AB-1003 → Password Reset
AB-1004 → Notes CRUD
AB-1005 → Pagination, Sorting & Filtering
AB-1006 → Tags
AB-1007 → Search
AB-1008 → Sharing
AB-1009 → Version History
AB-1010 → Frontend Authentication
AB-1011 → Notes List
AB-1012 → Note Editor
AB-1013 → Search UI
AB-1014 → Sharing UI
AB-1015 → Version History UI
AB-1016 → End-to-End Journey
```

---

## 4.3 Quality Gates

Every implementation phase and **every single sub-task** SHALL complete the following quality gates in this exact order:

1. `pnpm build`
2. `pnpm lint --max-warnings 0`
3. `pnpm test`

Development MUST NOT proceed beyond a failing checkpoint. Code with build errors, lint warnings/errors, or failing tests MUST NOT be committed.

---

## 4.4 OpenSpec Requirements

Every development ticket SHALL use OpenSpec as the source of implementation planning.

Required lifecycle:

```
Spec (spec.md)
→ Plan (plan.md)
→ Tasks (tasks.md)
→ Implementation (test-writer subagent)
→ Review (reviewer subagent)
→ Archive (openspec/archive/)
```

- **OpenSpec Directory Structure**: `openspec/changes/` and `openspec/archive/` MUST remain separate top-level sibling directories (never `changes/archive/`).
- **Artifact Naming Standard**: Standardize OpenSpec change artifacts to `spec.md`, `plan.md`, and `tasks.md`. A separate `proposal.md` is unnecessary if `plan.md` covers the implementation approach.
- **Spec Granularity**: Design the `/spec` command to generate a feature-specific `spec.md`. Avoid multiple spec files for a ticket unless the feature is genuinely complex.
- **Spec Delta Log (`spec-delta.md`)**: Maintain a `spec-delta.md` log inside `openspec/changes/<ticket>/` to log all specification updates and design changes for traceability.
- **Review Log (`review-log.md`)**: Optionally maintain a `review-log.md` inside `openspec/changes/<ticket>/` for complex features to track review history and decisions.
- **Requirement Changes & Delta Specs**: When a requirement changes (e.g. changing login/register credentials from email to phone number), developers MUST NOT directly overwrite existing baseline specs or create ad-hoc files. A **Delta Spec** (`spec-delta.md` or spec delta) MUST be created in the change proposal to document the exact diff/delta.

No implementation SHALL begin before an approved spec exists. Every completed change SHALL be archived before a pull request is prepared.

---

## 4.5 Claude Development Rules

Claude SHALL:

- Ask for explicit `[y/n]` permission before every file write.
- Work on only one ticket per session.
- Clear development context between completed tickets.
- Compact context when usage approaches approximately 70%.
- **Exact File References**: Always use exact file references (e.g. `@path/to/file` or `[filename](file:///path/to/file)`) in prompts, tasks, and reports to avoid ambiguity.
- **Secret Protection**: MUST NOT read, display, log, or commit secret `.env` files or raw environment credentials.
- **Automated Subagent Invocation**: MUST invoke the `test-writer` subagent (`.claude/agents/test-writer.md`) automatically to write tests alongside implementation, and the `reviewer` subagent (`.claude/agents/reviewer.md`) for pre-PR compliance review.
- **Test Writer Integrity**: The `test-writer` agent MUST generate happy path, negative, edge, boundary, integration, and regression tests. It MUST NEVER modify existing tests just to make them pass. If a failure is expected, document it; otherwise, report the issue so implementation code can be fixed.
- **Reviewer Report Accuracy**: The `reviewer` agent MUST produce highly accurate, detailed reports with a clear verdict, identified issues specifying WHAT is wrong, WHERE it is wrong (file + line numbers), WHY it is wrong (FRS/SDS/AGENTS reference), and HOW to fix it.
- Verify unfamiliar library APIs using the configured documentation tooling before implementation.
- Use separate Git worktrees for approved parallel tasks.

## 5. Architecture Patterns

- **Type Isolation**: No database models or raw entities are exposed to the frontend. All HTTP data uses DTO/schema types defined in `packages/shared`.
- **Token Rotation**: JWT Access Tokens (15 min, `Authorization` header) + Refresh Tokens (7 days, HTTP-only/Secure/SameSite cookie, persisted in DB, rotated on each refresh).
- **Soft Delete**: Implemented at the application-service layer via `Note.deletedAt`; preserves records for a 30-day recovery window.
- **No API Versioning**: All routes are prefixed directly with `/api` (no `/v1`).
- **Middleware Order** (strict, in this sequence): `helmet()` → `cors()` → `express.json()` → `cookieParser()` → `requestLogger` (Pino-http) → rate limiters → `authenticateToken` → API routes → global error handler.
- **Full-Text Search**: Native PostgreSQL FTS (`tsvector`/`ts_headline`/GIN index) against `Note.bodyText` — no external search engine.
- **Frontend State Split**: TanStack Query for server state (pagination, sorting, search, mutations with cache invalidation); Zustand for client UI state (`AuthStore`, `NoteStore`, `EditorStore`).

## 6. Coding Standards

- TypeScript SHALL operate under strict type-safety rules; explicit `any` used to bypass type safety MUST NOT be permitted.
- Shared types and validation schemas MUST NOT be duplicated across workspaces — reuse from `packages/shared`.
- Linting SHALL complete with zero warnings; formatting SHALL be consistently enforced across the monorepo.
- Code with failing build, lint, or test checks MUST NOT be committed.
- Commits follow Conventional Commits; `feat`/`fix` commits must reference an Azure Boards ticket (e.g. `feat(scope): description AB#1001`).

## 7. Authentication Approach

- Registration/login use email + password; passwords are securely hashed (never stored as plaintext).
- Successful auth returns an access token (body) and sets a `refreshToken` HTTP-only/Secure/SameSite cookie.
- Access tokens are short-lived (15 min); refresh tokens allow session renewal for up to 7 days and are persisted server-side, hashed with SHA-256.
- Logout deletes the corresponding `RefreshToken` DB row, invalidating renewal.
- `POST /api/auth/refresh` rotates tokens: the previous refresh token is invalidated and a new one issued.
- Forgot-password/reset uses a 6-digit OTP, hashed (SHA-256) and expiring after 15 minutes, single-use. No real email is sent — reset info is logged to the console.

## 8. API Design Conventions

- All success responses are JSON. Errors follow a consistent shape:
  ```json
  { "code": "ERROR_CODE", "message": "...", "fields": { "fieldName": "..." } }
  ```
- Standard error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_SERVER_ERROR`.
- Resource ownership violations return `403 FORBIDDEN`; missing/soft-deleted/purged resources return `404 NOT_FOUND`.
- List endpoints return `{ data: [...], meta: { totalCount, page, limit, totalPages } }`.
- All private endpoints require `Authorization: Bearer <accessToken>`; public share endpoint (`GET /api/share/:token`) requires no auth.
- Rate limiting applies per endpoint group (see SDS §5) — exceeding a limit returns `429` / `RATE_LIMIT_EXCEEDED`.

## 9. Database Schema Summary

PostgreSQL 16 via Prisma. Core models: `User`, `RefreshToken`, `Note`, `Tag`, `NoteTag` (join table), `ShareLink`, `NoteVersion`.

- `Note.content`/`NoteVersion.content` store TipTap JSON; `bodyText` holds extracted plain text for search indexing.
- `Note.deletedAt` (nullable) implements soft delete; `null` = active.
- `Tag` is unique per `(name, userId)` — user-scoped, case-insensitive uniqueness via a functional index.
- `ShareLink.tokenHash` stores a SHA-256 hash of the public token; tracks `expiresAt`, `viewCount`, `revoked`.
- `NoteVersion` stores incremental snapshots (`version`, `savedAt`) per note.
- Cascade deletes: deleting a `User` cascades `Note`/`Tag`/`RefreshToken` (not reachable via any endpoint — account deletion is out of scope). Purging a `Note` cascades its `NoteTag`, `ShareLink`, and `NoteVersion` rows.
- Two independent daily cron jobs perform physical deletion: `purgeNotes.ts` (notes soft-deleted > 30 days) and `purgeVersions.ts` (versions older than 90 days, independent of note state).
- Indexes: `Note.userId`, `Note.deletedAt`, `Note.createdAt`, `Note.updatedAt`, generated `tsvector` (GIN), `Tag(name, userId)`, `ShareLink.noteId`.

## 10. Testing Strategy

- Backend integration tests: Vitest + Supertest against the isolated `notes_test` database; each suite runs in a rolled-back transaction or truncates tables beforehand for isolation.
- Frontend component tests: Vitest + React Testing Library, mocking APIs with MSW.
- E2E tests: Playwright, covering the full registration-to-sharing browser journey.
- Every approved FRS acceptance-criteria scenario SHALL map to exactly one uniquely named automated test.
- New code SHALL maintain at least 80% automated test coverage.
- Happy-path and defined error scenarios SHALL be manually smoke tested before a ticket is considered complete.

## 11. Things to Never Do

- Do NOT implement real-time collaborative editing, file/image attachments, native/mobile apps, OAuth/social login, note folders/nested organization, or actual email delivery.
- Do NOT store passwords (or OTPs) as plaintext.
- Do NOT expose database models/entities directly to the frontend — always go through shared DTOs.
- Do NOT use `any` to bypass TypeScript type safety.
- Do NOT duplicate shared types/validation schemas outside `packages/shared`.
- Do NOT let a user access, modify, or delete another user's notes, tags, or version history.
- Do NOT allow modification through public share links — public access is strictly read-only.
- Do NOT expose content via expired, revoked, or soft-deleted-note share links.
- Do NOT execute user-generated rich-text content unsafely (must be sanitized, e.g. via DOMPurify).
- Do NOT physically delete a note before its 30-day soft-delete recovery window elapses.
- Do NOT commit code with failing builds, lint warnings, or failing tests.
- Do NOT skip, reorder, or combine tickets — the mandatory ticket sequence (FRS §18) must be followed strictly, one ticket per session.
- Do NOT introduce technology substitutions or floating `@latest` dependency versions.

## 12. Shared Package Rules

- `packages/shared` holds Zod schemas, TypeScript types, and validation rules used by both `backend` and `frontend`.
- Any type or validation schema needed by both frontend and backend SHALL live only in `packages/shared` — it MUST NOT be redefined or duplicated in either workspace.
- Before adding a new shared type, check whether an equivalent already exists in `packages/shared` and reuse it.
- Frontend and backend both consume DTOs/types from `packages/shared` rather than exposing raw Prisma models over HTTP (see Architecture Patterns, §5).
