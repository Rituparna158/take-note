---

name: "Spec"
description: "Create and get approval for a ticket's specification proposal before planning or implementation begins"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, proposal]
---------------------------------------

Create the specification proposal for a ticket. This is **Stage 1** of the project's Spec-Driven Development lifecycle:

**Proposal → Plan → Tasks → Implementation → Review → Archive**

This command creates the proposal only. It does **not** generate the implementation plan, task breakdown, or application code.

**Input**

The argument after `/spec` should be the Azure Boards ticket ID (for example, `AB-1004`) or a short description if the ticket ID is not yet available.

## Steps

### 1. Load project context

If these files have not already been loaded during the current session, read them in the following order:

1. `AGENTS.md` — project overview, architecture, coding standards, testing strategy, and shared package rules.
2. `CLAUDE.md` — Claude Code workflow, permission model, quality gates, branch conventions, and OpenSpec workflow.
3. `docs/FRS.md` — business requirements, acceptance criteria, and mandatory ticket sequence.
4. `docs/SDS.md` — software architecture, database schema, API contracts, and technical constraints.
5. `openspec/config.yaml` — OpenSpec project context, architecture constraints, team conventions, quality standards, and workflow configuration.
6. If the ticket affects backend functionality, read `backend/CLAUDE.md`.
7. If the ticket affects frontend functionality, read `frontend/CLAUDE.md`.
8. If the ticket affects shared DTOs, validation, or types, read `packages/shared/CLAUDE.md`.

---

### 2. Verify ticket order

Before creating the proposal:

* Locate the ticket in the mandatory implementation sequence defined in `docs/FRS.md`.
* Confirm that all preceding tickets have been completed.
* If the ticket is out of sequence, explain why and ask the user whether to continue.
* Never silently skip or reorder tickets.

---

### 3. Clarify ambiguous requirements

If the ticket, `docs/FRS.md`, or `docs/SDS.md` leaves important requirements unclear:

* Ask the user between **3 and 8** focused clarification questions.
* Do not invent business rules, API contracts, database behavior, or acceptance criteria.
* If information is missing from both FRS and SDS, request clarification before proceeding.

---

### 4. Create the OpenSpec proposal

Create the OpenSpec change.

```bash
openspec new change "<AB-ticket>-<short-kebab-name>"
```

Then generate the proposal instructions.

```bash
openspec instructions proposal --change "<change-name>" --json
```

Use the returned template to write the proposal.

The proposal should:

* Cover only the requested ticket.
* Reference the relevant FRS requirement IDs.
* Reference the applicable acceptance criteria.
* Respect architectural constraints defined in the SDS.
* Follow any context and rules provided by `openspec/config.yaml`.

Do **not** copy OpenSpec context or rules directly into the proposal.

Do **not** create:

* `plan.md`
* `tasks.md`
* implementation code
* tests

Those belong to later workflow stages.

---

### 5. Validate the proposal

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

* the proposal artifact exists,
* its status is **done**,
* no unexpected artifacts were created.

---

## Output

Summarize:

* Azure Boards ticket ID
* One-line description of the ticket
* FRS requirement IDs covered
* Acceptance-criteria scenarios covered
* Proposal file location

Finish with exactly:

> Please review and approve this proposal before I run `/plan`.

---

## Guardrails

* Never generate `plan.md`.
* Never generate `tasks.md`.
* Never write application code.
* Never create tests.
* Never skip or reorder the mandatory ticket sequence.
* Never invent requirements not defined in `docs/FRS.md` or `docs/SDS.md`.
* Stop immediately after the proposal is drafted and summarized.
* Wait for explicit user approval before continuing to `/plan`.
