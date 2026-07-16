---

name: "PR"
description: "Archive the completed OpenSpec change and prepare a pull request after a compliant review"
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, spec-driven, pull-request]
-------------------------------------------

Prepare a pull request for a completed ticket. This is the **final stage** of the project's Spec-Driven Development lifecycle:

**Proposal → Plan → Tasks → Implementation → Review → Archive**

This command requires a **COMPLIANT** result from `/review`. It archives the completed OpenSpec change and prepares the pull request. It does **not** implement code or perform the compliance review.

**Input**

The argument after `/pr` should be the Azure Boards ticket ID or the OpenSpec change name (for example, `AB-1004-notes-crud`).

## Steps

### 1. Confirm compliance review

Ask the user to confirm that:

* `/review` has been completed.
* The review reported **COMPLIANT**.
* Any reported findings have been resolved.

If the review has not been completed or is not compliant, stop immediately and instruct the user to complete `/review` before continuing.

---

### 2. Run quality checks in order

Run the following in sequence:

1. `pnpm build` — must complete with 0 errors and 0 warnings.
2. `pnpm lint --max-warnings 0`.
3. `pnpm test`.
4. Validate the generated commit message using the project's commitlint configuration (for example, via `npx commitlint`).

If any check fails:

* stop immediately,
* report the failure,
* do not continue to validation, archiving, or any Git operations.

---

### 3. Verify the remaining completion checklist

Confirm:

* OpenSpec validation succeeds.

```bash
openspec validate --change "<change-name>"
```

* Project coverage requirements are satisfied (if coverage information is available).
* Every approved acceptance criterion has a corresponding uniquely named automated test.
* Manual smoke testing has been completed (ask the user to confirm).

If any requirement is not satisfied, stop and report what remains.

---

### 4. Archive the OpenSpec change

After every verification step succeeds:

```bash
openspec archive "<change-name>"
```

Confirm the change has moved from:

```text
openspec/changes/
```

to

```text
openspec/archive/
```

Do not continue if archiving fails.

---

### 5. Generate the commit message

Generate a Conventional Commit following the project's conventions from `CLAUDE.md`.

Examples:

```text
feat(scope): description AB#ticket
fix(scope): description AB#ticket
```

`git add` and `git commit` may proceed without additional confirmation, following the project's Permission Model.

Never amend existing commits automatically.

Never bypass commit hooks.

---

### 6. Generate the pull request

Prepare:

**Title**

* concise,
* under 70 characters.

**Description**

Include:

* implementation summary,
* requirements covered,
* acceptance scenarios implemented,
* automated tests executed,
* quality-check summary,
* Azure Boards ticket reference.

---

### 7. Present a final summary

Before any remote operation, present:

* Azure Boards ticket
* OpenSpec change name
* Implemented requirements
* Archived OpenSpec artifacts
* Testing performed
* Quality-check results
* Completion checklist
* Branch name
* Commit message

---

### 8. Ask before pushing

Ask **[y/n]** before executing:

```bash
git push
```

Never push without explicit approval.

---

### 9. Ask before creating the pull request

Ask **[y/n]** before executing:

```bash
gh pr create
```

Never create a pull request without explicit approval.

After successful creation, report the pull request URL.

---

## Output

Summarize:

* Azure Boards ticket
* OpenSpec change name
* Validation status
* Archive confirmation
* Requirements implemented
* Spec artifacts archived
* Testing summary
* Branch name
* Commit message
* Pull request URL (if created)

---

## Guardrails

* Never continue past a failing `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`, or commitlint validation.
* Never continue if `/review` has not reported **COMPLIANT**.
* Never archive the OpenSpec change before all quality checks and validation succeed.
* Never create a pull request before the OpenSpec change has been archived.
* `git add` and `git commit` may proceed without asking, following the Permission Model in `CLAUDE.md`.
* Always ask **[y/n]** before `git push`.
* Always ask **[y/n]** before `gh pr create`.
* Never force-push.
* Never amend existing commits automatically.
* Never bypass commit hooks.
* Never assume manual smoke testing has been completed—always ask the user to confirm.
* Ensure the pull request clearly traces the implemented requirements and tested scenarios before it is created.
