---

name: "Implement"
description: "Implement an approved OpenSpec ticket task-by-task, running quality gates after every phase"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, implementation]
---------------------------------------------

Implement an approved ticket. This is **Stage 4** of the project's Spec-Driven Development lifecycle:

**Proposal → Plan → Tasks → Implementation → Review → Archive**

This command requires an approved proposal, implementation plan, and task checklist. It implements the approved tasks sequentially, writes tests alongside implementation, and never archives the change.

**Input**

The argument after `/implement` should be the Azure Boards ticket ID or the OpenSpec change name (for example, `AB-1004-notes-crud`).

## Steps

### 1. Confirm proposal, plan, and tasks are approved

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm that:

* the proposal artifact exists and its status is `done`,
* the design artifact exists and its status is `done`,
* the tasks artifact exists and its status is `done`.

If any artifact is missing or not approved:

* stop immediately,
* tell the user which prerequisite command must be completed (`/spec`, `/plan`, or `/tasks`),
* do not continue with implementation.

---

### 2. Load required context

Before writing any code, read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/FRS.md`
4. `docs/SDS.md`
5. `openspec/config.yaml`
6. The proposal artifact for this change.
7. The design artifact for this change.
8. The tasks artifact for this change.
9. `backend/CLAUDE.md` if the ticket affects backend code.
10. `frontend/CLAUDE.md` if the ticket affects frontend code.
11. `packages/shared/CLAUDE.md` if the ticket affects shared DTOs, types, or validation.

---

### 3. Get implementation instructions

Run:

```bash
openspec instructions apply --change "<change-name>" --json
```

Use the returned instructions to determine:

* current implementation progress,
* remaining tasks,
* required context files.

If:

* `state` indicates the change is blocked, stop and explain what prerequisite is missing.
* `state` indicates all tasks are complete, report that no implementation work remains and recommend running `/review`.

Do **not** archive the change.

---

### 4. Implement tasks sequentially

Work through the approved task checklist exactly as written.

Never:

* skip tasks,
* reorder tasks,
* combine multiple tasks into one implementation.

For every pending task:

1. Announce the task being implemented.
2. Ask **[y/n]** before every file creation or modification.
3. Implement only the approved scope of that task.
4. Write automated tests alongside the implementation.
5. Ensure each approved acceptance scenario maps to an automated test as required by the project's testing strategy.
6. Verify unfamiliar library APIs against the project's approved documentation before using them.
7. Mark the completed task in the OpenSpec task checklist.

Immediately pause if:

* the task is ambiguous,
* implementation conflicts with the approved proposal or design,
* new architectural decisions become necessary,
* a blocker or unexpected error occurs.

Report the issue and wait for user guidance instead of making assumptions.

---

### 5. Run quality gates

After each completed task or implementation phase (whichever is defined by the approved task checklist), run in this order:

1. `pnpm build`
2. `pnpm lint --max-warnings 0`
3. `pnpm test`

Every quality gate must pass before continuing.

If any quality gate fails:

* stop immediately,
* report the failure,
* resolve the issue before continuing.

Never continue beyond a failing quality gate.

---

### 6. Continue until complete

Repeat implementation and quality verification until:

* every approved task has been completed, or
* a blocker requires user intervention.

---

### 7. Do not archive

Never execute:

```bash
openspec archive
```

Archiving is performed only after `/review` has completed successfully.

---

## Output

When implementation finishes or pauses, summarize:

* Files created and modified
* Tests added
* Requirements implemented
* Assumptions made
* Current progress (`N/M` tasks complete)

Finish with one of the following:

* **Ready to run `/review`.**
* Or, if paused, clearly explain the blocker and what information is needed before implementation can continue.

---

## Guardrails

* Ask **[y/n]** before every file creation or modification.
* Follow the approved task checklist exactly.
* Respect the one-ticket-per-session rule.
* Write tests together with implementation.
* Never continue beyond a failing build, lint, or test.
* Never archive the OpenSpec change from this command.
* Never invent requirements or architecture.
* Pause whenever clarification is required instead of making assumptions.
