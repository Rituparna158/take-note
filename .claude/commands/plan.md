---

name: "Plan"
description: "Create and get approval for a ticket's technical implementation plan after its proposal is approved"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, planning]
---------------------------------------

Create the technical implementation plan for a ticket. This is **Stage 2** of the project's Spec-Driven Development lifecycle:

**Proposal → Plan → Tasks → Implementation → Review → Archive**

This command requires an approved proposal. It creates the technical implementation plan (OpenSpec's **design** artifact) only. It does **not** create tasks or write application code.

**Input**

The argument after `/plan` should be the Azure Boards ticket ID or the OpenSpec change name created by `/spec` (for example, `AB-1004-notes-crud`).

## Steps

### 1. Confirm the proposal is approved

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

* the proposal artifact exists,
* its status is `done`.

If no approved proposal exists:

* stop immediately,
* instruct the user to complete `/spec` first,
* do not continue with planning.

---

### 2. Load project context

If not already loaded during the current session, read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/FRS.md`
4. `docs/SDS.md`
5. `openspec/config.yaml`
6. `backend/CLAUDE.md` if the ticket affects backend code.
7. `frontend/CLAUDE.md` if the ticket affects frontend code.
8. `packages/shared/CLAUDE.md` if the ticket affects shared DTOs, types, or validation.

---

### 3. Read the approved proposal

Read the approved proposal artifact for the current OpenSpec change.

The implementation plan must remain consistent with the approved proposal and must not expand or change the approved scope.

---

### 4. Create the implementation plan

Generate the OpenSpec design instructions.

```bash
openspec instructions design --change "<change-name>" --json
```

Use the returned template to create the OpenSpec design artifact.

The plan should include:

* implementation approach,
* files and modules to create or modify,
* API endpoints involved,
* service boundaries,
* data flow,
* shared DTO usage,
* Prisma schema changes (if any),
* database migrations (if required),
* testing strategy,
* architecture decisions,
* quality checkpoints.

Reference:

* relevant FRS requirements,
* SDS architecture,
* API contracts,
* database schema,
* coding standards from `AGENTS.md`.

Apply any `context` and `rules` returned by OpenSpec as constraints.

Do **not** copy them into the document.

Do **not** create:

* task breakdown,
* implementation code,
* automated tests.

If the ticket requires deviating from an architecture defined in `docs/SDS.md` or `AGENTS.md`, stop and ask the user instead of making assumptions.

---

### 5. Validate

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

* proposal remains `done`,
* design is `done`,
* no task artifact has been created,
* no implementation artifacts exist.

---

## Output

Summarize:

* Ticket ID
* OpenSpec change name
* Key implementation decisions
* FRS sections referenced
* SDS sections referenced
* Design artifact location

Finish with exactly:

> Please review and approve this plan before I run `/tasks`.

---

## Guardrails

* Never create tasks.
* Never generate implementation code.
* Never generate tests.
* Never continue if the proposal has not been approved.
* Never change the approved scope during planning.
* Never invent architecture beyond what is defined in `docs/SDS.md` and `AGENTS.md`.
* Stop immediately after the implementation plan has been created and summarized.
* Wait for explicit user approval before continuing to `/tasks`.
