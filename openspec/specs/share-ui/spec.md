# share-ui Specification

## Purpose

TBD - created by archiving change ab-1014-sharing-ui. Update Purpose after archive.

## Requirements

### Requirement: Open Sharing Controls

A note owner viewing their own note in the note editor SHALL be able to open a sharing interface for that note.

#### Scenario: Note owner opens sharing controls

- **WHEN** a note owner opens sharing controls for their note from the note editor
- **THEN** the sharing interface is displayed

---

### Requirement: Generate Public Share Link With Expiration

The sharing interface SHALL allow the owner to generate a public share link for the note by calling `POST /api/notes/:id/share`. The owner SHALL be able to choose a supported expiration option (7, 14, or 30 days); if the owner does not choose one, the request SHALL be sent without an expiration and the server's default (7 days) SHALL apply. Once generated, the interface SHALL display the returned link, its expiration date, its view count, and its revoked state.

#### Scenario: Owner generates a share link

- **WHEN** a note owner generates a share link for their note
- **THEN** the generated public link is displayed in the sharing interface

#### Scenario: Owner configures supported expiration

- **WHEN** a note owner selects a supported expiration option and generates a share link
- **THEN** the displayed link reflects the selected expiration preference

#### Scenario: Owner generates a link without setting expiration

- **WHEN** a note owner generates a share link without selecting an expiration option
- **THEN** the sharing interface shows the server-applied default expiration as applied

---

### Requirement: Revoke Active Share Link

The sharing interface SHALL allow the owner to revoke the note's currently active share link by calling `DELETE /api/notes/:id/share`. After a successful revoke, the interface SHALL show the link as no longer active.

#### Scenario: Owner revokes a share link

- **WHEN** a note owner revokes their note's active share link from the sharing interface
- **THEN** the link is shown as no longer active

---

### Requirement: Sharing Operation Failure Feedback

When a generate or revoke sharing operation fails, the sharing interface SHALL provide visible failure feedback to the owner and SHALL NOT represent the operation as having succeeded.

#### Scenario: Sharing operation fails

- **WHEN** a generate or revoke sharing operation fails
- **THEN** the user receives visible failure feedback in the sharing interface
