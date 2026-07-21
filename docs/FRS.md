# Functional Requirements Specification

## Note Taking Application

**Version:** 1.2
**Status:** Draft
**Date:** July 2026
**Project:** Note Taking App

This document defines the functional and non-functional requirements for the Note Taking Application. It describes what the system must do and the expected user-facing and project workflow behaviour.

Technical architecture, database design, API contracts, technology-specific implementation decisions, and HTTP status codes are defined separately in `SDS.md`.

---

## 1. Purpose and Scope

### 1.1 Purpose

The Note Taking Application SHALL provide authenticated users with a centralized system for creating, organizing, searching, and sharing personal notes.

The system SHALL support rich-text note editing, user-scoped tags, full-text search, public read-only sharing, and historical note versions.

The project SHALL be developed using a spec-driven development workflow in which every ticket is specified, planned, decomposed into tasks, implemented, independently reviewed, and archived before a pull request is raised.

### 1.2 In Scope

The following capabilities are in scope:

- Project and monorepo foundation.
- Spec-driven development workflow setup.
- User registration, login, logout, and session management.
- Forgot-password and OTP-based password reset.
- Note creation, reading, updating, and soft deletion.
- Restoration of soft-deleted notes within the recovery window.
- Automatic permanent purge of soft-deleted notes.
- Note pagination and sorting.
- Note filtering by tags, including multi-tag filtering.
- User-scoped tag management.
- Note counts per tag.
- Full-text note search.
- Keyword highlighting in search results.
- Public read-only note sharing.
- Share-link expiration (default and configurable) and revocation.
- Public share-link view counting.
- Note version history.
- Historical version viewing and restoration.
- Automatic version-history purging.
- Frontend interfaces for all required user-facing features.
- End-to-end validation of the complete user journey.

### 1.3 Out of Scope

The following capabilities MUST NOT be implemented:

- Real-time collaborative editing.
- File attachments.
- Image attachments.
- Native or cross-platform mobile applications.
- OAuth authentication.
- Social login.
- Note folders.
- Nested note organization.
- Actual email delivery.

For password-reset operations, email delivery SHALL be simulated by logging the required reset information to the application console.

---

## 2. Project Foundation and Development Workflow (FR-INFRA)

### FR-INFRA-001: Monorepo Foundation [AB-1001]

**Business Rules:**

- The project SHALL use a single workspace-based monorepo.
- The monorepo SHALL contain separate frontend, backend, and shared-code workspaces.
- Code required by both the frontend and backend SHALL be maintained in the shared workspace.
- Shared TypeScript types and validation schemas MUST NOT be duplicated in frontend or backend code.
- All TypeScript code SHALL follow strict type-safety requirements.
- Explicit use of `any` for bypassing type safety MUST NOT be permitted.

**Acceptance Criteria:**

| Scenario                                                        | Expected Outcome                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| Developer installs the project from the repository root         | Dependencies for all workspaces are installed successfully     |
| Frontend and backend require the same type or validation schema | Both consume the definition from the shared workspace          |
| A shared type already exists                                    | The type is reused rather than duplicated in another workspace |

---

### FR-INFRA-002: Fixed Technology Foundation [AB-1001]

**Business Rules:**

- The project SHALL use the technology stack mandated by the assignment.
- Technology substitutions MUST NOT be introduced.
- Tool and dependency versions SHALL be pinned.
- Installation instructions MUST NOT depend on floating `latest` versions.

**Acceptance Criteria:**

| Scenario                                         | Expected Outcome                                               |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Project dependencies are inspected               | Required technologies are present                              |
| Dependency versions are inspected                | Tool versions are pinned rather than installed using `@latest` |
| An alternative framework or database is proposed | The substitution is rejected                                   |

---

### FR-INFRA-003: Code Quality Tooling [AB-1001]

**Business Rules:**

- The project SHALL provide automated linting.
- The project SHALL provide consistent code formatting.
- Zero lint warnings SHALL be permitted.
- The project SHALL provide automated Git hooks that prevent invalid code from being committed.
- A commit MUST be blocked when required quality checks fail.

**Acceptance Criteria:**

| Scenario                                                                | Expected Outcome                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Linting completes with no issues                                        | The lint command succeeds                                  |
| Linting produces a warning                                              | The lint command fails                                     |
| Developer attempts to commit code with a failing required quality check | The commit is blocked                                      |
| Code formatting is checked                                              | The project follows the configured shared formatting rules |

---

### FR-INFRA-004: Commit Standards [AB-1001]

**Business Rules:**

- Project commits SHALL follow the configured conventional commit format.
- Feature and fix commits SHALL reference the associated Azure Boards ticket.
- Invalid commit messages SHALL be rejected automatically.

**Acceptance Criteria:**

| Scenario                                                            | Expected Outcome                   |
| ------------------------------------------------------------------- | ---------------------------------- |
| Developer creates a valid ticket-linked feature commit              | Commit message validation succeeds |
| Developer creates an invalid commit message                         | Commit message validation fails    |
| A required ticket reference is missing from a feature or fix commit | Commit is rejected                 |

---

### FR-INFRA-005: Automated Testing Foundation [AB-1001]

**Business Rules:**

- The project SHALL provide automated unit and integration testing support.
- The project SHALL provide browser-based end-to-end testing support.
- Tests SHALL be executable through documented project commands.
- New code SHALL maintain at least 80% automated test coverage.
- Every approved specification scenario SHALL have exactly one correspondingly named test.

**Acceptance Criteria:**

| Scenario                                      | Expected Outcome                                                    |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Developer runs the project test command       | Configured automated tests execute successfully                     |
| End-to-end tests are invoked                  | Browser-based tests can execute using the configured test framework |
| A ticket introduces new code                  | New code meets the minimum coverage requirement                     |
| An approved specification contains a scenario | Exactly one named test corresponds to the scenario                  |

---

### FR-INFRA-006: Spec-Driven Development Workflow [AB-1001]

**Business Rules:**

- Every ticket SHALL have a written specification proposal before implementation begins.
- A ticket specification SHALL be reviewed and approved before technical planning begins.
- A technical plan SHALL be reviewed and approved before task decomposition begins.
- A task checklist SHALL be reviewed and approved before implementation begins.
- Tickets SHALL be implemented strictly in the mandated ticket sequence.
- One ticket SHALL be handled per Claude development session.
- Development context SHALL be cleared between tickets.
- Context SHALL be compacted when usage reaches approximately 70%.
- Long-running tasks estimated to exceed 45 minutes SHALL be delegated to a subagent.
- Session context files MUST NOT be used as a workaround for long-running tasks.
- Independent tasks marked as parallel SHALL use separate Git worktrees.
- Frontend and backend parallel development SHALL use separate worktrees.
- Claude SHALL request explicit `[y/n]` permission before every file write.
- Library API usage SHALL be verified using current documentation through the required documentation context tooling.

**Acceptance Criteria:**

| Scenario                                           | Expected Outcome                                             |
| -------------------------------------------------- | ------------------------------------------------------------ |
| A ticket has no approved specification             | Planning and implementation do not begin                     |
| Specification is approved but plan is not approved | Task decomposition and implementation do not begin           |
| Plan is approved but tasks are not approved        | Implementation does not begin                                |
| Claude attempts to write a file                    | Explicit `[y/n]` approval is requested first                 |
| A library API is required during implementation    | Current library documentation is consulted before API usage  |
| Two independent tasks are marked parallel          | Separate Git worktrees are used                              |
| A task is estimated above 45 minutes               | The task is delegated to a suitable subagent                 |
| A ticket is completed                              | Development context is cleared before the next ticket begins |

---

### FR-INFRA-007: AI Development Context [AB-1001]

**Business Rules:**

- The project SHALL provide a central AI-readable project context describing repository structure, technology constraints, architectural conventions, project commands, and prohibited patterns.
- Claude-specific behaviour SHALL be documented separately from general project context.
- Backend-specific development rules SHALL be available within the backend domain.
- Frontend-specific development rules SHALL be available within the frontend domain.
- Shared-package rules SHALL explicitly prohibit duplication of existing shared types and validation schemas.
- The project SHALL provide reusable development commands for starting, specifying, planning, task decomposition, implementation, review, and pull-request preparation.
- The project SHALL provide a read-only compliance reviewer.
- The compliance reviewer MUST NOT modify project files.

**Acceptance Criteria:**

| Scenario                                  | Expected Outcome                                            |
| ----------------------------------------- | ----------------------------------------------------------- |
| Claude begins work on a ticket            | Project and relevant domain context can be loaded           |
| Claude works in the backend domain        | Backend-specific rules are available                        |
| Claude works in the frontend domain       | Frontend-specific rules are available                       |
| Claude works with shared types or schemas | Shared-package reuse rules are available                    |
| Compliance reviewer is invoked            | Reviewer reads and reports findings without modifying files |

---

### FR-INFRA-008: Quality Gates [AB-1001]

**Business Rules:**

- Every implementation phase SHALL complete the mandatory build, lint, and test quality gates in the required order.
- Development MUST NOT proceed beyond a failing phase checkpoint.
- Code with failing tests, lint errors, or TypeScript build errors MUST NOT be committed.
- Before a pull request, implementation SHALL be reviewed in a fresh Claude session.
- Compliance review SHALL report no missing scenarios, specification drift, security findings, or uncovered functional requirements before pull-request preparation.
- The completed specification change SHALL be archived before a pull request is raised.

**Acceptance Criteria:**

| Scenario                                              | Expected Outcome                                   |
| ----------------------------------------------------- | -------------------------------------------------- |
| Build fails at a phase checkpoint                     | Implementation does not continue to the next phase |
| Lint fails at a phase checkpoint                      | Implementation does not continue to the next phase |
| Tests fail at a phase checkpoint                      | Implementation does not continue to the next phase |
| Fresh compliance review reports an unresolved finding | Pull-request preparation does not begin            |
| Specification change has not been archived            | Pull request is not raised                         |

---

## 3. User Authentication and Session Management (FR-AUTH)

### FR-AUTH-001: User Registration [AB-1002]

**Business Rules:**

- A user SHALL be able to register using an email address and password.
- The email address SHALL be valid.
- An email address SHALL identify only one user account.
- Duplicate registration using an already registered email address SHALL be rejected.
- Passwords SHALL be securely protected and MUST NOT be stored as plaintext.
- Successful registration SHALL create an authenticated user account.

**Acceptance Criteria:**

| Scenario                                       | Expected Outcome                                   |
| ---------------------------------------------- | -------------------------------------------------- |
| User provides valid registration information   | User account is created successfully               |
| User provides an invalid email address         | Registration is rejected                           |
| User registers using an existing email address | Registration is rejected with an appropriate error |
| User registration succeeds                     | User can continue as an authenticated user         |

---

### FR-AUTH-002: User Login [AB-1002]

**Business Rules:**

- Registered users SHALL be able to authenticate using their email address and password.
- Authentication SHALL be rejected when credentials are invalid.
- Successful login SHALL establish an authenticated session.
- Authentication failures MUST NOT expose sensitive password information.

**Acceptance Criteria:**

| Scenario                                     | Expected Outcome                        |
| -------------------------------------------- | --------------------------------------- |
| Registered user provides correct credentials | Authentication succeeds                 |
| User provides an incorrect password          | Authentication is rejected              |
| User provides an unregistered email address  | Authentication is rejected              |
| Authentication succeeds                      | An authenticated session is established |

---

### FR-AUTH-003: Authenticated Session Continuity [AB-1002]

**Business Rules:**

- An authenticated session SHALL use a short-lived access period of 15 minutes.
- Session renewal capability SHALL remain available for up to 7 days through a refresh credential associated with the user session.
- Refresh credentials SHALL be persisted by the system.
- Expired or invalid session credentials SHALL NOT grant protected access.

**Acceptance Criteria:**

| Scenario                                                                 | Expected Outcome                      |
| ------------------------------------------------------------------------ | ------------------------------------- |
| User has a valid authenticated session                                   | Protected functionality is accessible |
| Short-lived access period expires and valid session renewal is available | Session access can be renewed         |
| Session renewal credential is expired or invalid                         | Session renewal is rejected           |
| Invalid authentication credential is presented                           | Protected functionality is denied     |

---

### FR-AUTH-004: User Logout [AB-1002]

**Business Rules:**

- An authenticated user SHALL be able to log out.
- Logout SHALL invalidate the session renewal capability associated with the logged-out session.
- A logged-out session SHALL NOT be renewable using its invalidated session credential.

**Acceptance Criteria:**

| Scenario                                         | Expected Outcome                       |
| ------------------------------------------------ | -------------------------------------- |
| Authenticated user logs out                      | Current authenticated session is ended |
| Invalidated session renewal credential is reused | Session renewal is rejected            |

---

### FR-AUTH-005: Forgot Password Request [AB-1003]

**Business Rules:**

- A user SHALL be able to request password recovery using an email address.
- The system SHALL generate a one-time password reset code for an eligible account.
- The reset code SHALL be a 6-digit OTP.
- The reset code SHALL expire after 15 minutes.
- Actual email delivery SHALL NOT occur.
- Reset information SHALL be logged to the application console for development and assessment purposes.

**Acceptance Criteria:**

| Scenario                                               | Expected Outcome                                |
| ------------------------------------------------------ | ----------------------------------------------- |
| Password recovery is requested for an eligible account | A 6-digit reset OTP is generated                |
| Reset OTP is generated                                 | OTP remains valid for no more than 15 minutes   |
| Password recovery operation requires notification      | Reset information is logged rather than emailed |

---

### FR-AUTH-006: Password Reset Using OTP [AB-1003]

**Business Rules:**

- A user SHALL be able to submit a password-reset OTP and a new password.
- A valid, unexpired OTP SHALL permit password reset.
- An invalid OTP SHALL NOT permit password reset.
- An expired OTP SHALL NOT permit password reset.
- A successfully used OTP SHALL NOT be reusable.
- The new password SHALL be securely protected and MUST NOT be stored as plaintext.

**Acceptance Criteria:**

| Scenario                                                   | Expected Outcome                             |
| ---------------------------------------------------------- | -------------------------------------------- |
| User provides a valid unexpired OTP and valid new password | Password is reset successfully               |
| User provides an invalid OTP                               | Password reset is rejected                   |
| User provides an expired OTP                               | Password reset is rejected                   |
| User attempts to reuse a successfully consumed OTP         | Password reset is rejected                   |
| Password reset succeeds                                    | User can authenticate using the new password |

---

## 4. Note Management (FR-NOTE)

### FR-NOTE-001: Create Note [AB-1004]

**Business Rules:**

- An authenticated user SHALL be able to create a note.
- A note SHALL support a title and rich-text content.
- A note SHALL belong to exactly one user.
- A user SHALL NOT create a note on behalf of another user.

**Acceptance Criteria:**

| Scenario                                       | Expected Outcome                               |
| ---------------------------------------------- | ---------------------------------------------- |
| Authenticated user submits valid note content  | Note is created successfully                   |
| Note is created                                | Note is associated with the authenticated user |
| Unauthenticated user attempts to create a note | Creation is rejected                           |

---

### FR-NOTE-002: Read Note [AB-1004]

**Business Rules:**

- A user SHALL be able to view their own active notes.
- A user SHALL NOT access another user's private note through authenticated note operations.
- Soft-deleted notes SHALL NOT be returned through standard active-note read operations.

**Acceptance Criteria:**

| Scenario                                                            | Expected Outcome            |
| ------------------------------------------------------------------- | --------------------------- |
| User requests their own active note                                 | Note is returned            |
| User requests another user's private note                           | Note is not made accessible |
| User requests a soft-deleted note through the active-note operation | Note is not returned        |

---

### FR-NOTE-003: Update Note [AB-1004]

**Business Rules:**

- A user SHALL be able to update their own active note.
- A user SHALL be able to modify note title and rich-text content.
- A user SHALL NOT update another user's note.
- A soft-deleted note SHALL NOT be editable through standard note-update operations.

**Acceptance Criteria:**

| Scenario                                    | Expected Outcome   |
| ------------------------------------------- | ------------------ |
| User updates their own active note          | Changes are saved  |
| User attempts to update another user's note | Update is rejected |
| User attempts to update a soft-deleted note | Update is rejected |

---

### FR-NOTE-004: Soft Delete Note [AB-1004]

**Business Rules:**

- A user SHALL be able to delete their own note.
- Note deletion SHALL be implemented as a soft deletion.
- Soft deletion SHALL mark the note with a deletion time.
- A note MUST NOT be physically deleted during the 30-day recovery window.
- Soft-deleted notes SHALL be excluded from standard active-note operations.

**Acceptance Criteria:**

| Scenario                                                    | Expected Outcome           |
| ----------------------------------------------------------- | -------------------------- |
| User deletes their own active note                          | Note is marked as deleted  |
| Deleted note is queried through the active-note list        | Note is excluded           |
| Deleted note is inspected during the 30-day recovery window | Note data remains retained |
| User attempts to delete another user's note                 | Deletion is rejected       |

---

### FR-NOTE-005: Restore Soft-Deleted Note [AB-1004]

**Business Rules:**

- A user SHALL be able to restore their own soft-deleted note during the 30-day recovery window.
- Restoring a note SHALL return it to the active notes list immediately.
- A user SHALL NOT restore another user's soft-deleted note.
- A note that has been permanently purged SHALL NOT be restorable.

**Acceptance Criteria:**

| Scenario                                                             | Expected Outcome                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| User restores their own soft-deleted note within the recovery window | The note becomes active and appears in the active notes list |
| User attempts to restore another user's soft-deleted note            | Restore is rejected                                          |
| User attempts to restore a permanently purged note                   | Restore is rejected because the note no longer exists        |

---

### FR-NOTE-006: Notes Pagination [AB-1005]

**Business Rules:**

- A user's note list SHALL support pagination.
- Pagination SHALL provide sufficient information for navigating result pages.
- Pagination SHALL apply only to notes accessible to the authenticated user.

**Acceptance Criteria:**

| Scenario                                            | Expected Outcome                            |
| --------------------------------------------------- | ------------------------------------------- |
| User has more notes than fit within one result page | Notes are returned in multiple pages        |
| User requests another result page                   | Corresponding notes are returned            |
| User lists notes                                    | Notes belonging to other users are excluded |

---

### FR-NOTE-007: Notes Sorting [AB-1005]

**Business Rules:**

- Users SHALL be able to sort their notes by creation time.
- Users SHALL be able to sort their notes by last-updated time.
- Supported sort directions SHALL include ascending and descending order.

**Acceptance Criteria:**

| Scenario                        | Expected Outcome                   |
| ------------------------------- | ---------------------------------- |
| User sorts by creation time     | Notes are ordered by creation time |
| User sorts by last-updated time | Notes are ordered by last update   |
| User selects ascending order    | Results follow ascending order     |
| User selects descending order   | Results follow descending order    |

---

### FR-NOTE-008: Filter Notes by Tags [AB-1005]

**Business Rules:**

- Users SHALL be able to filter their active notes using tags.
- Only tags accessible to the authenticated user SHALL be valid for their note-filtering operations.
- When multiple tags are selected, only notes containing **all** selected tags SHALL be returned.
- Tag filtering SHALL work together with note pagination.

**Acceptance Criteria:**

| Scenario                                      | Expected Outcome                                   |
| --------------------------------------------- | -------------------------------------------------- |
| User filters notes using an associated tag    | Matching notes are returned                        |
| User filters notes using multiple tags        | Only notes matching all selected tags are returned |
| No active notes match the selected tag filter | An empty result set is returned                    |
| Filtered results span multiple pages          | Pagination remains available                       |

---

### FR-NOTE-009: Automatic Note Purge [AB-1004]

**Business Rules:**

- Notes that remain in the soft-deleted state for more than **30 days** SHALL be permanently removed from the system.
- Once permanently deleted, a note SHALL NOT be restorable or accessible by the user.
- Any resource associated exclusively with the deleted note — including public share links and historical version relationships — SHALL also be permanently removed as part of the purge process.
- The purge process SHALL execute automatically without requiring any user action.

**Acceptance Criteria:**

| Scenario                                                                           | Expected Outcome                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A note has remained soft-deleted for more than 30 days                             | The note is permanently deleted from the system automatically             |
| User attempts to restore a permanently purged note                                 | Restore fails because the note no longer exists                           |
| User attempts to access a previously generated public share link for a purged note | Access is denied because the underlying note has been permanently removed |

---

## 5. Tag Management (FR-TAG)

### FR-TAG-001: Create Tag [AB-1006]

**Business Rules:**

- An authenticated user SHALL be able to create tags.
- A tag SHALL belong to exactly one user.
- A tag SHALL support a name and color.
- Tags SHALL be scoped to their owner.
- Tag names SHALL be unique within the authenticated user's scope.

**Acceptance Criteria:**

| Scenario                                                                  | Expected Outcome                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| User creates a valid tag                                                  | Tag is created                                         |
| Tag is created                                                            | Tag belongs to the authenticated user                  |
| Another user has a tag with the same name                                 | The authenticated user's tag scope remains independent |
| User attempts to create a tag name that already exists in their own scope | Creation is rejected                                   |

---

### FR-TAG-002: Read Tags [AB-1006]

**Business Rules:**

- Users SHALL be able to list their own tags.
- A user SHALL NOT receive another user's tags in their tag list.
- Each tag SHALL include the number of active notes associated with it.

**Acceptance Criteria:**

| Scenario                                       | Expected Outcome                                              |
| ---------------------------------------------- | ------------------------------------------------------------- |
| User requests their tags                       | User's tags are returned                                      |
| Tag is associated with active notes            | Accurate active-note count is returned                        |
| Tag is associated only with soft-deleted notes | Soft-deleted notes do not contribute to the active-note count |

---

### FR-TAG-003: Update Tag [AB-1006]

**Business Rules:**

- A user SHALL be able to update their own tag.
- A tag's name and color SHALL be editable.
- A user SHALL NOT update another user's tag.

**Acceptance Criteria:**

| Scenario                                   | Expected Outcome      |
| ------------------------------------------ | --------------------- |
| User updates their own tag                 | Tag changes are saved |
| User attempts to update another user's tag | Update is rejected    |

---

### FR-TAG-004: Delete Tag [AB-1006]

**Business Rules:**

- A user SHALL be able to delete their own tag.
- Deleting a tag SHALL remove its association with notes.
- Deleting a tag SHALL NOT delete associated notes.
- A user SHALL NOT delete another user's tag.

**Acceptance Criteria:**

| Scenario                                   | Expected Outcome                  |
| ------------------------------------------ | --------------------------------- |
| User deletes their own tag                 | Tag is removed                    |
| Deleted tag was associated with notes      | Tag associations are removed      |
| Tag is deleted                             | Associated notes remain available |
| User attempts to delete another user's tag | Deletion is rejected              |

---

## 6. Note Search (FR-SEARCH)

### FR-SEARCH-001: Full-Text Note Search [AB-1007]

**Business Rules:**

- Authenticated users SHALL be able to search their active notes using keywords.
- Search SHALL consider note titles.
- Search SHALL consider note rich-text content.
- Search SHALL return only notes owned by the authenticated user.
- Soft-deleted notes SHALL NOT appear in standard search results.
- Search results SHALL support pagination.

**Acceptance Criteria:**

| Scenario                                  | Expected Outcome          |
| ----------------------------------------- | ------------------------- |
| Search keyword matches a note title       | Matching note is returned |
| Search keyword matches note content       | Matching note is returned |
| Matching note belongs to another user     | Note is not returned      |
| Matching note is soft-deleted             | Note is not returned      |
| Search returns more results than one page | Results are paginated     |

---

### FR-SEARCH-002: Search Result Highlighting [AB-1007]

**Business Rules:**

- Search results SHALL identify matching keyword occurrences.
- Search results SHALL provide highlighted match information suitable for visual presentation.
- Search highlighting SHALL NOT expose notes inaccessible to the authenticated user.

**Acceptance Criteria:**

| Scenario                                 | Expected Outcome                               |
| ---------------------------------------- | ---------------------------------------------- |
| Keyword matches searchable note text     | Result includes highlighted match information  |
| User views search results                | Matching keyword can be visually distinguished |
| Another user's note contains the keyword | No match information from that note is exposed |

---

## 7. Public Note Sharing (FR-SHARE)

### FR-SHARE-001: Generate Public Share Link [AB-1008]

**Business Rules:**

- A note owner SHALL be able to generate a public read-only link for their note.
- A share link SHALL provide public access without requiring authentication.
- Public access SHALL be read-only.
- A share link MAY have an expiration time configured by the owner within the supported range.
- If the owner does not specify an expiration period, the system SHALL apply the default share-link expiration.
- Users SHALL NOT configure an expiration period outside the supported range.
- Only the note owner SHALL be able to create a share link for the note.

**Acceptance Criteria:**

| Scenario                                                          | Expected Outcome                         |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Note owner generates a share link                                 | Public share link is created             |
| Note owner generates a share link without specifying expiration   | The default expiration period is applied |
| Note owner attempts to set expiration outside the supported range | The request is rejected                  |
| Public visitor opens a valid share link                           | Shared note can be viewed without login  |
| Public visitor uses a share link                                  | Shared note cannot be modified           |
| Non-owner attempts to generate a share link                       | Operation is rejected                    |

---

### FR-SHARE-002: Share Link Expiration [AB-1008]

**Business Rules:**

- A share link with an expiration time SHALL remain accessible only until that expiration time.
- An expired share link SHALL NOT provide note content.

**Acceptance Criteria:**

| Scenario                                | Expected Outcome              |
| --------------------------------------- | ----------------------------- |
| Public visitor opens a non-expired link | Shared note is accessible     |
| Public visitor opens an expired link    | Shared note is not accessible |

---

### FR-SHARE-003: Revoke Public Share Link [AB-1008]

**Business Rules:**

- A note owner SHALL be able to revoke an active share link.
- Revocation SHALL immediately disable future public access through that link.
- A revoked share link SHALL NOT expose note content.

**Acceptance Criteria:**

| Scenario                                | Expected Outcome              |
| --------------------------------------- | ----------------------------- |
| Note owner revokes an active share link | Link becomes invalid          |
| Public visitor opens a revoked link     | Shared note is not accessible |
| Non-owner attempts to revoke the link   | Operation is rejected         |

---

### FR-SHARE-004: Public Share View Count [AB-1008]

**Business Rules:**

- The system SHALL track the number of successful public views for each share link.
- Each successful public-link access SHALL increment the associated view count once.
- Concurrent successful public views SHALL NOT cause lost view-count updates.
- Invalid, expired, or revoked share-link requests SHALL NOT count as successful views.

**Acceptance Criteria:**

| Scenario                                       | Expected Outcome                                |
| ---------------------------------------------- | ----------------------------------------------- |
| Valid public share link is successfully viewed | View count increases by one                     |
| Multiple successful views occur concurrently   | All successful views are reflected in the count |
| Expired link is requested                      | View count does not increase                    |
| Revoked link is requested                      | View count does not increase                    |

---

### FR-SHARE-005: Sharing a Soft-Deleted Note [AB-1008]

**Business Rules:**

- A soft-deleted note SHALL NOT remain publicly accessible.
- Public links associated with a soft-deleted note SHALL NOT expose note content.

**Acceptance Criteria:**

| Scenario                                           | Expected Outcome                                |
| -------------------------------------------------- | ----------------------------------------------- |
| Active shared note is soft-deleted                 | Existing public link no longer exposes the note |
| Public visitor requests a shared soft-deleted note | Note content is not returned                    |

---

## 8. Note Version History (FR-VER)

### FR-VER-001: Save Note Version Snapshot [AB-1009]

**Business Rules:**

- The system SHALL preserve note history through version snapshots.
- A note save that updates note content SHALL create the required historical snapshot.
- Historical snapshots SHALL preserve the note state required for version viewing and restoration.

**Acceptance Criteria:**

| Scenario                                    | Expected Outcome                                            |
| ------------------------------------------- | ----------------------------------------------------------- |
| Existing note content is saved with changes | Version history records the required snapshot               |
| Multiple note saves occur                   | Version history preserves the sequence of saved note states |

---

### FR-VER-002: List Note Versions [AB-1009]

**Business Rules:**

- A note owner SHALL be able to list available historical versions of their note.
- A user SHALL NOT list version history for another user's private note.

**Acceptance Criteria:**

| Scenario                            | Expected Outcome                |
| ----------------------------------- | ------------------------------- |
| Note owner requests version history | Available versions are returned |
| Non-owner requests version history  | Version history is not exposed  |

---

### FR-VER-003: View Historical Version [AB-1009]

**Business Rules:**

- A note owner SHALL be able to view a selected historical version.
- Historical version viewing SHALL NOT modify the current note.

**Acceptance Criteria:**

| Scenario                                          | Expected Outcome                  |
| ------------------------------------------------- | --------------------------------- |
| Note owner selects an existing historical version | Historical note state is returned |
| Historical version is viewed                      | Current note remains unchanged    |
| User requests another user's historical version   | Historical content is not exposed |

---

### FR-VER-004: Restore Historical Version [AB-1009]

**Business Rules:**

- A note owner SHALL be able to restore a selected historical version.
- Version restoration SHALL NOT destructively remove existing version history.
- Restoring a historical version SHALL create a new current saved state and preserve the version timeline.

**Acceptance Criteria:**

| Scenario                                | Expected Outcome                              |
| --------------------------------------- | --------------------------------------------- |
| Note owner restores an existing version | Note reflects the restored state              |
| Historical version is restored          | A new version state is added to the timeline  |
| Version is restored                     | Existing historical versions remain available |
| Non-owner attempts version restoration  | Operation is rejected                         |

---

### FR-VER-005: Automatic Version Purging [AB-1009]

**Business Rules:**

- The system SHALL automatically purge historical note snapshots according to the configured version-retention period.
- Version purging SHALL occur without requiring manual user action.
- Purged historical snapshots SHALL no longer be available for viewing or restoration.
- Automatic purging SHALL apply to historical snapshots and MUST NOT delete the current note solely because of version retention.

**Acceptance Criteria:**

| Scenario                                                    | Expected Outcome                                          |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Historical snapshot exceeds the configured retention period | Snapshot is automatically removed                         |
| Historical snapshot is purged                               | Snapshot cannot be viewed                                 |
| Historical snapshot is purged                               | Snapshot cannot be restored                               |
| Version retention process runs                              | Current note is not deleted because of snapshot retention |

---

## 9. Frontend Authentication Experience (FR-UI-AUTH)

### FR-UI-AUTH-001: Authentication Pages [AB-1010]

**Business Rules:**

- The frontend SHALL provide user interfaces for registration.
- The frontend SHALL provide a login interface.
- The frontend SHALL provide a forgot-password interface.
- The frontend SHALL provide an OTP-based password-reset interface.
- Authentication forms SHALL display validation and operation errors.
- Successful authentication SHALL provide access to authenticated application functionality.

**Acceptance Criteria:**

| Scenario                              | Expected Outcome                                   |
| ------------------------------------- | -------------------------------------------------- |
| User opens registration functionality | Registration form is available                     |
| User opens login functionality        | Login form is available                            |
| User requests password recovery       | Forgot-password flow is available                  |
| User proceeds with password reset     | OTP and new-password input capability is available |
| Authentication operation fails        | User receives visible error feedback               |
| Authentication succeeds               | User can access authenticated functionality        |

---

## 10. Frontend Notes List Experience (FR-UI-NOTES)

### FR-UI-NOTES-001: Notes List Page [AB-1011]

**Business Rules:**

- The frontend SHALL provide a notes list page for authenticated users.
- The page SHALL display the user's accessible active notes.
- The page SHALL support note pagination.
- The page SHALL provide supported sorting controls.
- The page SHALL provide tag-filter controls, including selection of multiple tags.
- Loading and operation states SHALL provide visible user feedback.

**Acceptance Criteria:**

| Scenario                                | Expected Outcome                                    |
| --------------------------------------- | --------------------------------------------------- |
| Authenticated user opens the notes page | User's active notes are displayed                   |
| Notes are loading                       | Visible loading feedback is displayed               |
| User changes page                       | Corresponding notes are displayed                   |
| User changes sorting                    | Note order updates                                  |
| User applies a tag filter               | Matching notes are displayed                        |
| User applies multiple tag filters       | Only notes matching all selected tags are displayed |

---

## 11. Frontend Note Editor Experience (FR-UI-EDITOR)

### FR-UI-EDITOR-001: Rich-Text Note Editor [AB-1012]

**Business Rules:**

- The frontend SHALL provide a rich-text note editor.
- The editor SHALL allow users to create note content.
- The editor SHALL allow users to update their own active notes.
- Rich-text content SHALL be presented safely.
- The editor SHALL support assigning accessible user tags to a note.

**Acceptance Criteria:**

| Scenario                                        | Expected Outcome                              |
| ----------------------------------------------- | --------------------------------------------- |
| User creates a note                             | Rich-text editing is available                |
| User opens their active note for editing        | Existing content is available in the editor   |
| User changes rich-text content                  | Updated content can be saved                  |
| User assigns an accessible tag                  | Tag is associated with the note               |
| Note content contains unsafe executable content | Unsafe content is not executed during display |

---

### FR-UI-EDITOR-002: Note Autosave [AB-1012]

**Business Rules:**

- The note editor SHALL automatically save changed note content after a period of user inactivity.
- Autosave SHALL avoid unnecessary save operations when no relevant content change has occurred.
- When an autosave operation fails, the application SHALL automatically retry before notifying the user of the failure.
- An autosave failure SHALL provide visible feedback to the user only after retry attempts are exhausted.
- Failed autosave operations SHALL NOT be represented as successfully saved.

**Acceptance Criteria:**

| Scenario                                    | Expected Outcome                                               |
| ------------------------------------------- | -------------------------------------------------------------- |
| User changes note content and stops editing | Changed note content is automatically saved                    |
| No note content has changed                 | Unnecessary save is not performed                              |
| Autosave succeeds                           | User can identify the saved state                              |
| Autosave fails on first attempt             | The application retries the autosave before notifying the user |
| Autosave fails after retry attempts         | User receives visible failure feedback                         |

---

## 12. Frontend Search Experience (FR-UI-SEARCH)

### FR-UI-SEARCH-001: Search Interface [AB-1013]

**Business Rules:**

- The frontend SHALL provide a note-search interface.
- Search results SHALL display accessible matching notes.
- Search results SHALL support pagination.
- Search match information SHALL be visually highlighted.

**Acceptance Criteria:**

| Scenario                                 | Expected Outcome                        |
| ---------------------------------------- | --------------------------------------- |
| User submits a search keyword            | Matching notes are displayed            |
| Search result contains match information | Matching text is visually distinguished |
| Search results span multiple pages       | User can navigate result pages          |
| Search returns no matching notes         | An appropriate empty state is displayed |

---

## 13. Frontend Sharing Experience (FR-UI-SHARE)

### FR-UI-SHARE-001: Share Note Interface [AB-1014]

**Business Rules:**

- A note owner SHALL be able to open sharing controls for their note.
- The frontend SHALL allow the owner to generate a public share link.
- The frontend SHALL support the available share-link expiration option, including the default expiration when none is specified.
- The frontend SHALL allow an active share link to be revoked.
- Sharing operations SHALL provide visible success and failure feedback.

**Acceptance Criteria:**

| Scenario                                          | Expected Outcome                           |
| ------------------------------------------------- | ------------------------------------------ |
| Note owner opens sharing controls                 | Sharing interface is displayed             |
| Owner generates a share link                      | Generated public link is displayed         |
| Owner configures supported expiration             | Expiration preference is applied           |
| Owner generates a link without setting expiration | The default expiration is shown as applied |
| Owner revokes a share link                        | Link is shown as no longer active          |
| Sharing operation fails                           | User receives visible failure feedback     |

---

## 14. Frontend Version History Experience (FR-UI-VER)

### FR-UI-VER-001: Version History Drawer [AB-1015]

**Business Rules:**

- The frontend SHALL provide a version-history drawer for a note.
- The drawer SHALL list available historical versions.
- A user SHALL be able to select and view a historical version.
- Viewing a historical version SHALL NOT modify the current note.

**Acceptance Criteria:**

| Scenario                         | Expected Outcome                    |
| -------------------------------- | ----------------------------------- |
| Note owner opens version history | Version-history drawer is displayed |
| Historical versions exist        | Available versions are listed       |
| User selects a version           | Historical content is displayed     |
| User previews a version          | Current note remains unchanged      |

---

### FR-UI-VER-002: Restore Version Experience [AB-1015]

**Business Rules:**

- The frontend SHALL allow the note owner to restore a selected historical version.
- The restore action SHALL clearly identify the version selected for restoration.
- Successful restoration SHALL update the displayed current note state.
- Restore failures SHALL provide visible feedback.

**Acceptance Criteria:**

| Scenario                                          | Expected Outcome                               |
| ------------------------------------------------- | ---------------------------------------------- |
| User selects an available version for restoration | Restore action is available                    |
| Restore succeeds                                  | Current note display reflects restored content |
| Restore fails                                     | User receives visible error feedback           |

---

## 15. End-to-End User Journey (FR-E2E)

### FR-E2E-001: Complete Application Journey [AB-1016]

**Business Rules:**

- The completed application SHALL support an automated browser-based user journey covering the core application capabilities.
- The journey SHALL validate interaction between the frontend and backend.
- The journey SHALL execute using the configured end-to-end testing framework.

**Acceptance Criteria:**

| Scenario                                             | Expected Outcome                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| User completes the required core application journey | Registration, authentication, note management, tagging, search, sharing, version history, and logout capabilities work together successfully |
| End-to-end journey executes                          | Browser-based test completes without application errors                                                                                      |

---

## 16. Non-Functional Requirements

### NFR-001: Type Safety

- TypeScript SHALL operate under strict type-safety rules.
- `any` MUST NOT be used to bypass type safety.
- Shared TypeScript types SHALL be maintained in the shared package.

### NFR-002: Code Quality

- Linting SHALL complete with zero warnings.
- Formatting SHALL be consistently enforced across the monorepo.
- Code with build, lint, or test failures MUST NOT be committed.

### NFR-003: Test Quality

- New code SHALL maintain at least 80% automated test coverage.
- Every approved specification scenario SHALL have exactly one named automated test.
- Happy-path and defined error scenarios SHALL be manually smoke tested before a ticket is considered complete.

### NFR-004: Security

- Plaintext passwords MUST NOT be persisted.
- Invalid authentication credentials MUST NOT grant protected access.
- Users MUST NOT access private notes, tags, or version history owned by another user.
- Public note access SHALL be read-only.
- Expired or revoked share links MUST NOT expose note content.
- User-generated rich-text content SHALL be handled so executable malicious content is not executed when displayed.

### NFR-005: Data Isolation

- User-owned notes SHALL remain isolated between users.
- User-owned tags SHALL remain isolated between users.
- User-owned note-version history SHALL remain isolated between users.
- Authenticated private operations SHALL operate only on data accessible to the authenticated user.

### NFR-006: Traceability

- Functional requirements SHALL use unique requirement identifiers.
- Functional requirements SHALL be traceable to their assigned ticket.
- Pull-request descriptions SHALL identify every functional requirement covered.
- Pull-request descriptions SHALL identify every approved specification scenario tested.

### NFR-007: Specification Compliance

A ticket SHALL be considered complete only when:

- OpenSpec validation passes.
- A fresh-session read-only compliance review reports all requirements and scenarios as compliant.
- The build completes with zero errors and zero warnings.
- Linting completes with zero warnings.
- Automated tests pass.
- New code meets the minimum 80% coverage requirement.
- Every approved specification scenario has exactly one named test.
- Defined happy-path and error scenarios have been manually smoke tested.
- The completed OpenSpec change has been archived.
- The pull-request checklist is complete.
- The conventional commit is linked to the appropriate ticket.

### NFR-008: Security & Abuse Prevention (Rate Limiting)

To protect the application from misuse and automated attacks:

- Authentication endpoints SHALL enforce request rate limiting.
- Password reset requests SHALL be rate limited.
- Public share-link access SHALL be rate limited to reduce abuse.
- When a configured rate limit is exceeded, the system SHALL reject the request with an appropriate error response.
- The exact rate-limit thresholds and implementation strategy are defined in the companion `SDS.md` document.

---

## 17. Requirement Traceability Matrix

| Requirement Namespace | Capability                                                                               | Ticket(s)        |
| --------------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| FR-INFRA              | Project foundation, tooling, AI context, workflow, and quality gates                     | AB-1001          |
| FR-AUTH               | Registration, login, logout, sessions, and OTP password reset                            | AB-1002, AB-1003 |
| FR-NOTE               | Note CRUD, soft delete, restore, automatic purge, pagination, sorting, and tag filtering | AB-1004, AB-1005 |
| FR-TAG                | User-scoped tag CRUD and note counts                                                     | AB-1006          |
| FR-SEARCH             | Full-text note search and match highlighting                                             | AB-1007          |
| FR-SHARE              | Public links, expiration, revocation, and atomic view counting                           | AB-1008          |
| FR-VER                | Version snapshots, viewing, restoration, and automatic purging                           | AB-1009          |
| FR-UI-AUTH            | Authentication frontend                                                                  | AB-1010          |
| FR-UI-NOTES           | Notes list frontend                                                                      | AB-1011          |
| FR-UI-EDITOR          | Rich-text editor and autosave                                                            | AB-1012          |
| FR-UI-SEARCH          | Search frontend and highlights                                                           | AB-1013          |
| FR-UI-SHARE           | Share modal and share-link controls                                                      | AB-1014          |
| FR-UI-VER             | Version-history drawer and restore experience                                            | AB-1015          |
| FR-E2E                | Complete browser-based user journey                                                      | AB-1016          |
| FR-UI-POLISH          | Frontend TipTap editor toolbar, loading states, and UX enhancements                      | AB-1017          |

---

## 18. Mandatory Ticket Sequence

Tickets SHALL be implemented in the following order without skipping or reordering:

1. `AB-1001` — Project setup: monorepo, Prisma, Claude context files, agents, skills, and MCPs.
2. `AB-1002` — Authentication: register, login, logout, access token, and refresh token.
3. `AB-1003` — Authentication: forgot password and OTP reset.
4. `AB-1004` — Notes: full CRUD, soft delete, restore, and automatic purge.
5. `AB-1005` — Notes: pagination, sorting, and tag filtering.
6. `AB-1006` — Tags: CRUD and note count per tag.
7. `AB-1007` — Search: full-text search, highlighting, and pagination.
8. `AB-1008` — Sharing: generate link, revoke, public access, and atomic view counting.
9. `AB-1009` — Version history: snapshot, list, view, restore, and automatic purging.
10. `AB-1010` — Frontend authentication pages.
11. `AB-1011` — Frontend notes list page.
12. `AB-1012` — Frontend note editor with rich-text editing and autosave.
13. `AB-1013` — Frontend search interface with highlights.
14. `AB-1014` — Frontend share modal and active-link controls.
15. `AB-1015` — Frontend version-history drawer and restore.
16. `AB-1016` — End-to-end browser-based full user journey.
17. `AB-1017` — Frontend TipTap editor toolbar, UX conventions, loading states, and UI polish.

A later ticket MUST NOT begin before the preceding ticket has satisfied the project's Definition of Done.

---

**End of Functional Requirements Specification**
