---

name: "Tasks"
description: "Create and get approval for a ticket's task checklist after its plan is approved"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, tasks]
------------------------------------

Create the task checklist for a ticket. This is **Stage 3** of the project's Spec-Driven Development lifecycle:

**Proposal → Plan → Tasks → Implementation → Review → Archive**

This command requires an approved proposal and an approved implementation plan. It creates the OpenSpec **tasks** artifact only. It does **not** write application code or tests.

**Input**

The argument after `/tasks` should be the Azure Boards ticket ID or the OpenSpec change name created by `/spec` (for example, `AB-1004-notes-crud`).

## Steps

### 1. Confirm the proposal and plan are approved

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

* the proposal artifact exists and its status is `done`,
* the design artifact exists and its status is `done`.

If either artifact is missing or not approved:

* stop immediately,
* instruct the user to complete `/spec` and/or `/plan` first,
* do not continue with task decomposition.

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

### 3. Read the approved artifacts

Read the approved proposal artifact and design artifact for the current OpenSpec change.

The task checklist must implement exactly what those artifacts define. It must not expand, narrow, or reinterpret the approved scope or architecture.

---

### 4. Create the task checklist

Generate the OpenSpec task instructions.

```bash
openspec instructions tasks --change "<change-name>" --json
```

Use the returned template to create the OpenSpec tasks artifact.

Each task should:

* represent one logical unit of work that can be independently implemented and verified,
* map traceably to one or more FRS requirements, acceptance criteria, or sections of the approved design artifact,
* identify the files or modules it will modify, consistent with the implementation plan,
* indicate the applicable quality gates (`pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`),
* identify where automated tests will be required according to the project's testing strategy defined in `docs/FRS.md`,
* flag tasks estimated to take more than 45 minutes as candidates for subagent delegation,
* identify tasks that can safely execute in parallel (for example, independent backend and frontend work) as candidates for separate Git worktrees.

Apply any `context` and `rules` returned by OpenSpec as constraints when generating the artifact.

Do **not** copy them into the document.

Do **not** create:

* implementation code,
* automated tests,
* additional architectural decisions not already present in the approved design artifact.

If the approved design is not detailed enough to create tasks, stop and ask the user to revisit `/plan` rather than inventing architecture.

---

### 5. Validate

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

* the proposal artifact remains `done`,
* the design artifact remains `done`,
* the tasks artifact exists and its status is `done`,
* no implementation artifacts have been created.

---

## Output

Summarize:

* Azure Boards ticket ID
* OpenSpec change name
* Total number of implementation tasks
* Brief summary of each implementation phase
* Tasks identified for subagent delegation
* Tasks identified for Git worktree parallelization
* Tasks artifact location

Finish with exactly:

> Please review and approve this task checklist before I run `/implement`.

---

## Guardrails

* Never generate implementation code.
* Never generate automated tests.
* Never continue if the proposal or implementation plan has not been approved.
* Never change the approved scope or architecture while decomposing tasks.
* Never invent requirements or architectural decisions beyond what is defined in the approved proposal and design artifacts.
* If the approved design is insufficient, stop and return the ticket to `/plan`.
* Stop immediately after the task checklist has been created and summarized.
* Wait for explicit user approval before continuing to `/implement`.
