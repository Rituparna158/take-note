# tag-management Specification

## Purpose

TBD - created by archiving change ab-1006-tag-management. Update Purpose after archive.

## Requirements

### Requirement: Create Tag

An authenticated user SHALL be able to create a tag. A tag SHALL belong to exactly one user, SHALL support a name and a color, and SHALL be scoped to its owner. Tag names SHALL be unique within the authenticated user's own scope; another user's tag with the same name SHALL NOT affect this uniqueness check.

#### Scenario: User creates a valid tag

- **WHEN** an authenticated user submits a valid name and color to create a tag
- **THEN** the tag is created

#### Scenario: Created tag belongs to its creator

- **WHEN** a tag is created by an authenticated user
- **THEN** the tag belongs to that authenticated user

#### Scenario: Another user's tag with the same name does not conflict

- **WHEN** another user already has a tag with the same name
- **THEN** the authenticated user's own tag scope remains independent and unaffected

#### Scenario: Duplicate tag name within the same user's scope is rejected

- **WHEN** an authenticated user attempts to create a tag whose name already exists in their own scope
- **THEN** the creation is rejected

---

### Requirement: Read Tags

Users SHALL be able to list their own tags. A user SHALL NOT receive another user's tags in their tag list. Each returned tag SHALL include the number of active (non-soft-deleted) notes associated with it.

#### Scenario: User requests their tags

- **WHEN** an authenticated user requests their tag list
- **THEN** the user's own tags are returned

#### Scenario: Tag active-note count reflects active notes

- **WHEN** a tag is associated with one or more active notes
- **THEN** the returned tag includes an accurate active-note count

#### Scenario: Soft-deleted notes are excluded from the active-note count

- **WHEN** a tag is associated only with soft-deleted notes
- **THEN** those soft-deleted notes do not contribute to the tag's active-note count

---

### Requirement: Update Tag

A user SHALL be able to update their own tag's name and color. A user SHALL NOT update another user's tag. Renaming a tag SHALL be subject to the same per-user uniqueness rule enforced at creation.

#### Scenario: User updates their own tag

- **WHEN** an authenticated user submits a name or color change for their own tag
- **THEN** the tag changes are saved

#### Scenario: User cannot update another user's tag

- **WHEN** an authenticated user attempts to update a tag owned by another user
- **THEN** the update is rejected

---

### Requirement: Delete Tag

A user SHALL be able to delete their own tag. Deleting a tag SHALL remove its associations with notes but SHALL NOT delete the associated notes themselves. A user SHALL NOT delete another user's tag.

#### Scenario: User deletes their own tag

- **WHEN** an authenticated user deletes one of their own tags
- **THEN** the tag is removed

#### Scenario: Deleting a tag removes its note associations

- **WHEN** a deleted tag was associated with one or more notes
- **THEN** those tag associations are removed

#### Scenario: Deleting a tag preserves its associated notes

- **WHEN** a tag is deleted
- **THEN** its previously associated notes remain available and unaffected

#### Scenario: User cannot delete another user's tag

- **WHEN** an authenticated user attempts to delete a tag owned by another user
- **THEN** the deletion is rejected
