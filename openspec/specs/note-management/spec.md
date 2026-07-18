# note-management Specification

## Purpose

TBD - created by archiving change ab-1004-note-management. Update Purpose after archive.

## Requirements

### Requirement: Create Note

An authenticated user SHALL be able to create a note. A note SHALL support a title and rich-text content, and SHALL belong to exactly one user — the authenticated caller. A user SHALL NOT be able to create a note on behalf of another user.

#### Scenario: Authenticated user creates a note with valid content

- **WHEN** an authenticated user submits a valid title and rich-text content to create a note
- **THEN** the note is created successfully

#### Scenario: Created note is associated with its creator

- **WHEN** a note is created by an authenticated user
- **THEN** the note is associated with that authenticated user as its owner

#### Scenario: Unauthenticated note creation is rejected

- **WHEN** an unauthenticated request attempts to create a note
- **THEN** the creation is rejected

---

### Requirement: Read Note

A user SHALL be able to view their own active notes. A user SHALL NOT access another user's private note through authenticated note operations. Soft-deleted notes SHALL NOT be returned through standard active-note read operations.

#### Scenario: User reads their own active note

- **WHEN** a user requests one of their own active notes
- **THEN** the note is returned

#### Scenario: User cannot read another user's note

- **WHEN** a user requests another user's private note
- **THEN** the note is not made accessible to the requester

#### Scenario: Soft-deleted note is not returned via standard read

- **WHEN** a user requests a soft-deleted note through the standard active-note read operation
- **THEN** the note is not returned

---

### Requirement: Update Note

A user SHALL be able to update their own active note, including its title and rich-text content. A user SHALL NOT update another user's note. A soft-deleted note SHALL NOT be editable through standard note-update operations.

#### Scenario: User updates their own active note

- **WHEN** a user submits changes to the title or content of their own active note
- **THEN** the changes are saved

#### Scenario: User cannot update another user's note

- **WHEN** a user attempts to update a note owned by another user
- **THEN** the update is rejected

#### Scenario: Soft-deleted note cannot be updated

- **WHEN** a user attempts to update a note that is currently soft-deleted
- **THEN** the update is rejected

---

### Requirement: Soft Delete Note

A user SHALL be able to delete their own note. Note deletion SHALL be implemented as a soft deletion that marks the note with a deletion timestamp rather than removing it. A note MUST NOT be physically deleted during its 30-day recovery window, and soft-deleted notes SHALL be excluded from standard active-note operations. A user SHALL NOT delete another user's note.

#### Scenario: User soft-deletes their own active note

- **WHEN** a user deletes one of their own active notes
- **THEN** the note is marked as deleted rather than removed from the system

#### Scenario: Soft-deleted note excluded from active list

- **WHEN** a soft-deleted note is queried through the active-note list operation
- **THEN** the note is excluded from the results

#### Scenario: Soft-deleted note data is retained during the recovery window

- **WHEN** a soft-deleted note is inspected during its 30-day recovery window
- **THEN** the note's data remains retained in the system

#### Scenario: User cannot delete another user's note

- **WHEN** a user attempts to delete a note owned by another user
- **THEN** the deletion is rejected

---

### Requirement: Restore Soft-Deleted Note

A user SHALL be able to restore their own soft-deleted note during the 30-day recovery window, immediately returning it to the active notes list. A user SHALL NOT restore another user's soft-deleted note. A note that has been permanently purged SHALL NOT be restorable.

#### Scenario: User restores their own soft-deleted note within the recovery window

- **WHEN** a user restores one of their own soft-deleted notes before the 30-day recovery window has elapsed
- **THEN** the note becomes active and appears in the active notes list

#### Scenario: User cannot restore another user's soft-deleted note

- **WHEN** a user attempts to restore a soft-deleted note owned by another user
- **THEN** the restore is rejected

#### Scenario: Purged note cannot be restored

- **WHEN** a user attempts to restore a note that has been permanently purged
- **THEN** the restore is rejected because the note no longer exists

---

### Requirement: Automatic Note Purge

Notes that remain soft-deleted for more than 30 days SHALL be permanently removed from the system automatically, without requiring any user action. Once permanently deleted, a note SHALL NOT be restorable or accessible by the user. Any resource associated exclusively with the purged note — including public share links and historical version relationships — SHALL also be permanently removed as part of the purge process.

#### Scenario: Note soft-deleted for more than 30 days is permanently purged

- **WHEN** a note has remained soft-deleted for more than 30 days
- **THEN** the note is permanently deleted from the system automatically

#### Scenario: Restoring a permanently purged note fails

- **WHEN** a user attempts to restore a note that has been permanently purged
- **THEN** the restore fails because the note no longer exists

#### Scenario: Public share link for a purged note no longer grants access

- **WHEN** a public visitor attempts to access a previously generated share link for a note that has since been permanently purged
- **THEN** access is denied because the underlying note has been permanently removed

### Requirement: Notes Pagination

A user's note list SHALL support pagination. Pagination SHALL provide sufficient information for navigating result pages. Pagination SHALL apply only to notes accessible to the authenticated user.

#### Scenario: User has more notes than fit within one result page

- **WHEN** a user has more active notes than the configured page size
- **THEN** notes are returned across multiple pages

#### Scenario: User requests another result page

- **WHEN** a user requests a specific page of their active notes
- **THEN** the corresponding notes for that page are returned

#### Scenario: User lists notes

- **WHEN** a user lists active notes
- **THEN** notes belonging to other users are excluded from the results

---

### Requirement: Notes Sorting

Users SHALL be able to sort their notes by creation time. Users SHALL be able to sort their notes by last-updated time. Supported sort directions SHALL include ascending and descending order.

#### Scenario: User sorts by creation time

- **WHEN** a user requests their notes sorted by creation time
- **THEN** notes are ordered by creation time

#### Scenario: User sorts by last-updated time

- **WHEN** a user requests their notes sorted by last-updated time
- **THEN** notes are ordered by last update

#### Scenario: User selects ascending order

- **WHEN** a user selects ascending sort order
- **THEN** results follow ascending order

#### Scenario: User selects descending order

- **WHEN** a user selects descending sort order
- **THEN** results follow descending order

---

### Requirement: Filter Notes by Tags

Users SHALL be able to filter their active notes using tags. Only tags accessible to the authenticated user SHALL be valid for their note-filtering operations. When multiple tags are selected, only notes containing **all** selected tags SHALL be returned. Tag filtering SHALL work together with note pagination.

#### Scenario: User filters notes using an associated tag

- **WHEN** a user filters their active notes using a tag associated with one or more of their notes
- **THEN** matching notes are returned

#### Scenario: User filters notes using multiple tags

- **WHEN** a user filters their active notes using multiple tag IDs
- **THEN** only notes matching all selected tags are returned

#### Scenario: No active notes match the selected tag filter

- **WHEN** no active notes match the selected tag filter
- **THEN** an empty result set is returned

#### Scenario: Filtered results span multiple pages

- **WHEN** filtered results span more than one page
- **THEN** pagination remains available
