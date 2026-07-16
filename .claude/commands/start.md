---
name: "Start"
description: "Initialize a Claude session before any implementation"
category: Workflow
tags: [workflow, onboarding, context]
---

Initialize a Claude session before starting work on any ticket.

**Purpose**

Load the complete project context so implementation never starts without understanding the project rules, architecture, and specifications.

## Steps

Read the following files in order before responding:

1. `AGENTS.md` — project overview, repository structure, tech stack, architecture patterns, coding standards, authentication, API conventions, database summary, testing strategy, and shared package rules.
2. `CLAUDE.md` — Claude Code-specific rules, permission model, context management, thinking depth, commit conventions, branch naming, quality gates, file write rules, and OpenSpec workflow.
3. `docs/FRS.md` — Functional Requirements Specification (business requirements, acceptance criteria, ticket sequence).
4. `docs/SDS.md` — Software Design Specification (architecture, database design, API contracts, implementation constraints).
5. `openspec/config.yaml` — OpenSpec project context, architectural constraints, team conventions, quality standards, and workflow configuration.
6. If working on backend, read `backend/CLAUDE.md`.
7. If working on frontend, read `frontend/CLAUDE.md`.
8. If working on shared types or validation, read `packages/shared/CLAUDE.md`.

## Output

After reading all applicable files, respond with exactly:

> Ready. Loaded FRS, SDS, and project context. What are we building?

## Guardrails

- Do not start any implementation until explicitly given a ticket or task.
- Do not modify files, run database migrations, or generate code as part of this command.
- This command only initializes project context.
- Follow the one-ticket-per-session rule defined in `CLAUDE.md`.
- Use this command at the beginning of every new Claude session and after `/clear`.