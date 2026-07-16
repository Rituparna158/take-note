---

name: "Review"
description: "Run a fresh-session, read-only compliance review of an implemented ticket before pull-request preparation"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, review, compliance]
-------------------------------------------------

Run a read-only compliance review of an implemented ticket. This is **Stage 5** of the project's Spec-Driven Development lifecycle:

**Proposal → Plan → Tasks → Implementation → Review → Archive**

This review:

* **Should be performed in a fresh Claude session** whenever possible to provide an independent compliance check.
* **Must remain read-only.** It must never modify project files, check off tasks, fix bugs, or update documentation.

**Input**

The argument after `/review` should be the Azure Boards ticket ID or the OpenSpec change name (for example, `AB-1004-notes-crud`).

## Steps

### 1. Verify this is a fresh review

If the current conversation previously implemented this same ticket:

* inform the user that an independent review is recommended from a fresh session,
* recommend running `/clear` and then invoking `/review` again,
* ask whether to continue anyway.

Do not silently treat an implementation session as an independent review.

---

### 2. Load project context

Read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/FRS.md`
4. `docs/SDS.md`
5. `openspec/config.yaml`
6. The proposal artifact for this change.
7. The design artifact for this change.
8. The tasks artifact for this change.
9. `backend/CLAUDE.md` if applicable.
10. `frontend/CLAUDE.md` if applicable.
11. `packages/shared/CLAUDE.md` if applicable.

---

### 3. Identify implementation changes

Use read-only Git commands (for example, `git diff`, `git log`, and `git show`) to determine every file modified for the ticket.

Base the review on the repository's current state rather than conversation history.

---

### 4. Verify requirement and scenario coverage

For every acceptance criterion defined for the ticket:

* verify there is a corresponding automated test,
* identify missing tests,
* identify duplicate or ambiguous tests,
* confirm implementation matches the approved requirements.

---

### 5. Check for specification drift

Compare the implementation against:

* the approved proposal,
* the approved design,
* `docs/SDS.md`,
* `docs/FRS.md`.

Report any deviations involving:

* API contracts,
* database schema,
* middleware order,
* authentication,
* authorization,
* error response format,
* rate limiting,
* implementation scope.

---

### 6. Perform a security review

Review the implementation for:

* plaintext password or OTP storage,
* missing authentication,
* missing ownership validation,
* cross-user data exposure,
* public endpoints allowing unauthorized modification,
* expired or revoked share links exposing data,
* unsanitized rich-text rendering,
* other security concerns defined by the project requirements.

---

### 7. Verify quality gates

Run:

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
```

Report the result of each command.

If coverage information is available, verify that the project's coverage requirement has been satisfied.

Do not modify code to fix failures.

---

### 8. Verify OpenSpec consistency

Run:

```bash
openspec status --change "<change-name>" --json
```

Confirm:

* all approved tasks are completed,
* implementation matches the approved task checklist,
* no unexpected inconsistencies exist between the implementation and the OpenSpec artifacts.

---

## Output

Produce a compliance report using these sections:

### Missing scenarios

List any approved scenarios that were not implemented or tested.

### Specification drift

List any implementation that differs from the approved proposal, design, FRS, or SDS.

### Security findings

List any security concerns.

### Uncovered requirements

List any approved requirements that remain unimplemented.

### Quality gate results

Report:

* Build
* Lint
* Tests
* Coverage (if available)

### OpenSpec consistency

Summarize the consistency between the approved artifacts and the implementation.

Finish with exactly one of the following:

> **COMPLIANT — ready to run `/pr`.**

or

> **NOT COMPLIANT — resolve the reported findings before running `/pr`.**

---

## Guardrails

* Never modify files.
* Never update code.
* Never check off tasks.
* Never change OpenSpec artifacts.
* Never skip the fresh-review recommendation.
* Base every finding on the approved project documentation and current implementation.
* Whenever possible, reference the affected file and line number for each finding.
* If no issues are found, explicitly state that the implementation is compliant.
