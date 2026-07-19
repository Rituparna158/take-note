## MODIFIED Requirements

### Requirement: Create Note

An authenticated user SHALL be able to create a note. A note SHALL support a title and rich-text content, and SHALL belong to exactly one user — the authenticated caller. A user SHALL NOT be able to create a note on behalf of another user. A note MAY be associated with zero or more of the authenticated user's own tags at creation time via a `tagIds` field; a user SHALL NOT associate a tag they do not own with a note. Creating a note SHALL automatically save an initial historical version snapshot capturing the note's title and content at creation time.

#### Scenario: Authenticated user creates a note with valid content

- **WHEN** an authenticated user submits a valid title and rich-text content to create a note
- **THEN** the note is created successfully

#### Scenario: Created note is associated with its creator

- **WHEN** a note is created by an authenticated user
- **THEN** the note is associated with that authenticated user as its owner

#### Scenario: Unauthenticated note creation is rejected

- **WHEN** an unauthenticated request attempts to create a note
- **THEN** the creation is rejected

#### Scenario: Note created with tags owned by the authenticated user

- **WHEN** an authenticated user submits `tagIds` referencing one or more of their own tags while creating a note
- **THEN** the note is created, associated with those tags, and the tags are included in the note's response

#### Scenario: Note creation rejects a tag not owned by the user

- **WHEN** an authenticated user submits a `tagIds` value that does not belong to their own tags while creating a note
- **THEN** the creation is rejected

#### Scenario: Note creation saves an initial version snapshot

- **WHEN** a note is created with a title and content
- **THEN** an initial historical version snapshot recording that title and content is saved for the note

---

### Requirement: Update Note

A user SHALL be able to update their own active note, including its title and rich-text content. A user SHALL NOT update another user's note. A soft-deleted note SHALL NOT be editable through standard note-update operations. A user MAY replace a note's associated tags via a `tagIds` field; a user SHALL NOT associate a tag they do not own with a note. When an update changes the note's title or content, a new historical version snapshot SHALL be saved capturing the updated state. When an update changes only the note's tag associations, with no change to title or content, no new version snapshot SHALL be saved.

#### Scenario: User updates their own active note

- **WHEN** a user submits changes to the title or content of their own active note
- **THEN** the changes are saved

#### Scenario: User cannot update another user's note

- **WHEN** a user attempts to update a note owned by another user
- **THEN** the update is rejected

#### Scenario: Soft-deleted note cannot be updated

- **WHEN** a user attempts to update a note that is currently soft-deleted
- **THEN** the update is rejected

#### Scenario: Note updated with tags owned by the authenticated user

- **WHEN** a user replaces the `tagIds` on their own active note with a set of their own tags
- **THEN** the note's tag associations are updated to match, and the tags are included in the response

#### Scenario: Note update rejects a tag not owned by the user

- **WHEN** a user submits a `tagIds` value that does not belong to their own tags while updating a note
- **THEN** the update is rejected

#### Scenario: Note update with changed title or content saves a new version snapshot

- **WHEN** a user updates their own active note with a title or content that differs from the note's current stored state
- **THEN** a new historical version snapshot recording the updated title and content is saved for the note

#### Scenario: Note update with only tag changes does not save a new version snapshot

- **WHEN** a user updates their own active note's `tagIds` only, with no change to title or content
- **THEN** no new historical version snapshot is saved for the note
