@AGENTS.md

# CLAUDE.md

This file contains Claude Code specific development rules for this repository. Project overview, tech stack, architecture, and functional requirements live in `AGENTS.md` (and its sources, `docs/FRS.md`/`docs/SDS.md`) — this file does not repeat that content.

## Permission Model

- Ask `[y/n]` before:
  - Writing or modifying files.
  - `git push`.
  - Running database migrations.
  - Deleting files or directories.

- Proceed without asking:
  - Reading files.
  - Searching the codebase.
  - Running `pnpm build`.
  - Running `pnpm lint`.
  - Running `pnpm test`.
  - Viewing `git status`, `git diff`, or `git log`.
  - `git add`.
  - `git commit`.

## Context Management

- One ticket per Claude session.
- Run `/clear` between completed tickets.
- Compact context when usage approaches approximately 70%.
- Never let the context window fill to the absolute limit.

## Thinking Depth

- Default reasoning for normal tasks (routine edits, small fixes, running commands).
- Think hard for implementation tasks (writing feature code against an approved plan).
- Ultrathink only for architecture decisions (schema changes, API contract design, cross-cutting technical tradeoffs).

## Commit Message Format

Refines the Conventional Commits and Azure Boards rule defined in AGENTS.md.

- `feat(scope): description AB#ticket`
- `fix(scope): description AB#ticket`

## Branch Naming Convention

Branches follow the Azure Boards ticket structure:

- `feature/<domain>/AB-<ticket>-<short-description>`
- `fix/<domain>/AB-<ticket>-<short-description>`
- `chore/<domain>/AB-<ticket>-<short-description>`

Examples:

- `feature/backend/AB-1002-auth`
- `feature/frontend/AB-1010-auth-pages`
- `fix/backend/AB-1008-share-link-expiry`

## Security & Secret Protection

- **Environment Secret Protection**: Claude MUST NOT read, display, log, or commit secret `.env` files or raw environment credentials. Secret variables and private keys MUST NOT be printed to the console or included in artifacts.

## Quality Gates

- **Per-Subtask Quality Check**: Quality gates (`pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`, in exact order) MUST be executed after **every single sub-task** during implementation. Development MUST NOT proceed to the next sub-task if any quality gate fails.

### Before every commit

1. `npx commitlint --from HEAD~1` must pass.
2. Husky `pre-commit` hook must pass successfully.

### Never commit if

- Any build fails.
- Any lint errors or warnings remain.
- Any tests are failing.
- TypeScript compilation fails.

## File Write Rules

- Never modify `docs/FRS.md` or `docs/SDS.md` without explicit user approval. They are the project's approved source of truth.
- Prefer editing existing files instead of creating new ones whenever possible.
- Create new files only when required by the current approved ticket or workflow.
- Documentation and planning files should only be created if explicitly requested or if they are part of the approved development workflow (for example, OpenSpec `spec.md`, `plan.md`, and `tasks.md`).
- New implementation files must be created inside the correct workspace (`backend/`, `frontend/`, or `packages/shared/`) and never directly in the repository root unless intentionally part of the project infrastructure.
- OpenSpec artifacts must be created under `openspec/changes/<ticket-id>/` and moved to `openspec/archive/<ticket-id>/` only through the archive workflow. `openspec/changes/` and `openspec/archive/` MUST remain separate top-level sibling directories (never `changes/archive/`).

## OpenSpec & Workflow Rules

- **Lifecycle**: Follows the lifecycle defined in AGENTS.md §4.4 (`Spec → Plan → Implement → Test → Review → PR`).
- **Exact File References**: Always use exact file references (e.g. `@path/to/file` or `[filename](file:///path/to/file)`) in prompts, tasks, and reports to avoid ambiguity.
- **Subagent Invocation**: During implementation, the `test-writer` subagent (`.claude/agents/test-writer.md`) MUST be invoked automatically to write tests alongside code. Before PR preparation, the `reviewer` subagent (`.claude/agents/reviewer.md`) MUST be invoked for read-only compliance review.
- **Test Writer Integrity**: The `test-writer` agent MUST generate happy path, negative, edge, boundary, integration, and regression tests. It MUST NEVER modify existing tests just to make them pass. If a failure is expected, document it; otherwise, report the issue so implementation code can be fixed.
- **Reviewer Report Accuracy**: The `reviewer` agent MUST produce highly accurate, detailed reports with a clear verdict, identified issues specifying WHAT is wrong, WHERE it is wrong (file + line numbers), WHY it is wrong (FRS/SDS/AGENTS reference), and HOW to fix it.
- **Artifact Naming Standard**: Standardize OpenSpec change artifacts to `spec.md`, `plan.md`, and `tasks.md`. A separate `proposal.md` is unnecessary if `plan.md` covers the implementation approach.
- **Spec Granularity**: Design `/spec` to generate a feature-specific `spec.md`. Avoid multiple spec files for a ticket unless the feature is genuinely complex.
- **Spec Delta Log (`spec-delta.md`)**: Maintain `spec-delta.md` inside `openspec/changes/<ticket>/` to log all specification updates and design changes for traceability.
- **Review Log (`review-log.md`)**: Optionally maintain `review-log.md` inside `openspec/changes/<ticket>/` for complex features to track review history and decisions.
- **Requirement Changes & Delta Specs**: When a requirement changes (e.g. changing login/register credentials from email to phone number), developers MUST NOT directly overwrite existing baseline specs or create ad-hoc files. A **Delta Spec** (`spec-delta.md` or spec delta) MUST be created in the change proposal to document the exact diff/delta.
