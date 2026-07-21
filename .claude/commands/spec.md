---
name: "Spec"
description: "Create and get approval for a ticket's specification proposal and OpenSpec delta spec(s) before planning or implementation begins"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, proposal]
---

---

Create the feature specification (`spec.md`) and its required OpenSpec delta spec (`spec-delta.md`) for a ticket. This is **Stage 1** of the project's Spec-Driven Development lifecycle:

**Spec (spec.md) → Plan (plan.md) → Tasks (tasks.md) → Implementation → Review → Archive**

Within OpenSpec's own artifact graph, `proposal` and `specs` are both foundation artifacts: `design` (the `/plan` output) and `specs` each depend only on `proposal`, and `tasks` depends on both `design` and `specs`. This command produces **both** foundation artifacts — the proposal and its delta spec(s) — so nothing downstream is missing later. It does **not** generate the implementation plan (`design.md`), task breakdown, or application code.

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

- Locate the ticket in the mandatory implementation sequence defined in `docs/FRS.md`.
- Confirm that all preceding tickets have been completed.
- If the ticket is out of sequence, explain why and ask the user whether to continue.
- Never silently skip or reorder tickets.

---

### 3. Clarify ambiguous requirements

If the ticket, `docs/FRS.md`, or `docs/SDS.md` leaves important requirements unclear:

- Ask the user between **3 and 8** focused clarification questions.
- Do not invent business rules, API contracts, database behavior, or acceptance criteria.
- If information is missing from both FRS and SDS, request clarification before proceeding.

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

- Cover only the requested ticket.
- Reference the relevant FRS requirement IDs.
- Reference the applicable acceptance criteria.
- Respect architectural constraints defined in the SDS.
- Follow any context and rules provided by `openspec/config.yaml`.

Do **not** copy OpenSpec context or rules directly into the proposal.

Do **not** create:

- `design.md`
- `tasks.md`
- implementation code
- tests

Those belong to later workflow stages.

The proposal's **Capabilities** section (New Capabilities / Modified Capabilities) is the contract for step 5 below — every capability listed there needs a corresponding delta spec file. Do not leave it vague or empty.

---

### 5. Create the OpenSpec delta spec(s)

Once the proposal is written, generate the delta specification(s) it requires. This step is mandatory — a proposal is never considered complete on its own.

```bash
openspec instructions specs --change "<change-name>" --json
```

For each capability listed under the proposal's **New Capabilities** and **Modified Capabilities** sections, write one delta spec file at:

```
openspec/changes/<change-name>/specs/<capability>/spec.md
```

- Use the exact kebab-case capability name from the proposal.
- For a **new** capability, use `## ADDED Requirements`.
- For a **modified** capability, copy the existing requirement block from `openspec/specs/<capability>/spec.md` in full, place it under `## MODIFIED Requirements`, and edit only what changes.
- Every requirement uses `### Requirement: <name>` with SHALL/MUST language.
- Every requirement has at least one `#### Scenario: <name>` (exactly four hashtags) with `**WHEN**` / `**THEN**` lines.
- Each scenario must map to an acceptance-criteria scenario already defined in `docs/FRS.md` — do not invent new behavior here.

Do **not** create `design.md` or `tasks.md` in this step either.

---

### 6. Validate both artifacts

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

- the `proposal` artifact status is **done**,
- the `specs` artifact status is **done**,
- a spec file exists for every capability named in the proposal,
- no unexpected artifacts (`design`, `tasks`) were created.

---

## Output

Summarize:

- Azure Boards ticket ID
- One-line description of the ticket
- FRS requirement IDs covered
- Acceptance-criteria scenarios covered
- Proposal file location
- Delta spec file location(s), one per capability

Finish with exactly:

> Please review and approve this proposal and its delta spec(s) before I run `/plan`.

---

## Guardrails

- Never generate `design.md`.
- Never generate `tasks.md`.
- Never write application code.
- Never create tests.
- Never finish the command with the proposal written but the delta spec(s) missing.
- Never skip or reorder the mandatory ticket sequence.
- Never invent requirements not defined in `docs/FRS.md` or `docs/SDS.md`.
- Stop immediately after the proposal and delta spec(s) are drafted and summarized together.
- Wait for explicit user approval of both artifacts before continuing to `/plan`.
