@AGENTS.md

# CLAUDE.md

This file contains Claude Code specific development rules for this repository. Project overview, tech stack, architecture, and functional requirements live in `AGENTS.md` (and its sources, `docs/FRS.md`/`docs/SDS.md`) — this file does not repeat that content.

## Permission Model

* Ask `[y/n]` before:
  * Writing or modifying files.
  * `git push`.
  * Running database migrations.
  * Deleting files or directories.

* Proceed without asking:
  * Reading files.
  * Searching the codebase.
  * Running `pnpm build`.
  * Running `pnpm lint`.
  * Running `pnpm test`.
  * Viewing `git status`, `git diff`, or `git log`.
  * `git add`.
  * `git commit`.

## Context Management

* One ticket per Claude session.
* Run `/clear` between completed tickets.
* Compact context when usage approaches approximately 70%.
* Never let the context window fill to the absolute limit.

## Thinking Depth

* Default reasoning for normal tasks (routine edits, small fixes, running commands).
* Think hard for implementation tasks (writing feature code against an approved plan).
* Ultrathink only for architecture decisions (schema changes, API contract design, cross-cutting technical tradeoffs).

## Commit Message Format

Refines the Conventional Commits and Azure Boards rule defined in AGENTS.md.

* `feat(scope): description AB#ticket`
* `fix(scope): description AB#ticket`

## Branch Naming Convention

Branches follow the Azure Boards ticket structure:

* `feature/<domain>/AB-<ticket>-<short-description>`
* `fix/<domain>/AB-<ticket>-<short-description>`
* `chore/<domain>/AB-<ticket>-<short-description>`

Examples:

* `feature/backend/AB-1002-auth`
* `feature/frontend/AB-1010-auth-pages`
* `fix/backend/AB-1008-share-link-expiry`

## Quality Gates

Enforced exactly as defined in AGENTS.md §4.3 (`pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`, in order, no proceeding past a failing checkpoint).

### Before every commit

1. `npx commitlint --from HEAD~1` must pass.
2. Husky `pre-commit` hook must pass successfully.

### Never commit if

* Any build fails.
* Any lint errors or warnings remain.
* Any tests are failing.
* TypeScript compilation fails.

## File Write Rules

* Never modify `docs/FRS.md` or `docs/SDS.md` without explicit user approval. They are the project's approved source of truth.
* Prefer editing existing files instead of creating new ones whenever possible.
* Create new files only when required by the current approved ticket or workflow.
* Documentation and planning files should only be created if explicitly requested or if they are part of the approved development workflow (for example, OpenSpec proposals, plans, and tasks).
* New implementation files must be created inside the correct workspace (`backend/`, `frontend/`, or `packages/shared/`) and never directly in the repository root unless intentionally part of the project infrastructure.
* OpenSpec artifacts must be created only under `openspec/changes/<ticket-id>/` and moved to `openspec/archive/` only through the archive workflow.

## OpenSpec Workflow Rules

Follows the lifecycle defined in AGENTS.md §4.4 (Proposal → Plan → Tasks → Implementation → Review → Archive). No implementation begins before an approved proposal exists, and every completed change is archived (`openspec archive AB-xxxx`) before a pull request is prepared.
