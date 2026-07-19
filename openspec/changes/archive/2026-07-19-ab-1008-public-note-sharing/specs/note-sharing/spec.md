## ADDED Requirements

### Requirement: Generate Public Share Link

A note owner SHALL be able to generate a public read-only link for their own note via `POST /api/notes/:id/share`. The link SHALL provide public access to the note's content without requiring authentication, and that public access SHALL be read-only. The owner MAY configure an expiration period in days within the supported range of 1–30; if omitted, the system SHALL apply the default expiration of 7 days. An expiration value outside the supported range SHALL be rejected. Only the note's owner SHALL be able to generate a share link for it.

#### Scenario: Note owner generates a share link

- **WHEN** a note owner requests a share link for their own note
- **THEN** a public share link is created for that note

#### Scenario: Note owner generates a share link without specifying expiration

- **WHEN** a note owner generates a share link without specifying an expiration period
- **THEN** the default expiration period of 7 days is applied

#### Scenario: Note owner attempts to set expiration outside the supported range

- **WHEN** a note owner requests a share link with an expiration period outside the supported 1–30 day range
- **THEN** the request is rejected as a validation error

#### Scenario: Public visitor opens a valid share link

- **WHEN** a public visitor opens a valid, non-expired, non-revoked share link
- **THEN** the shared note's content can be viewed without authentication

#### Scenario: Public visitor uses a share link

- **WHEN** a public visitor accesses a note through a share link
- **THEN** the note cannot be modified through that public access

#### Scenario: Non-owner attempts to generate a share link

- **WHEN** an authenticated user who does not own the note attempts to generate a share link for it
- **THEN** the operation is rejected

---

### Requirement: Share Link Expiration

A share link SHALL remain accessible only until its configured expiration time. An expired share link SHALL NOT provide the underlying note's content to a public visitor.

#### Scenario: Public visitor opens a non-expired link

- **WHEN** a public visitor opens a share link before its expiration time
- **THEN** the shared note is accessible

#### Scenario: Public visitor opens an expired link

- **WHEN** a public visitor opens a share link after its expiration time
- **THEN** the shared note is not accessible

---

### Requirement: Revoke Public Share Link

A note owner SHALL be able to revoke their note's currently active share link via `DELETE /api/notes/:id/share`. Revocation SHALL immediately disable future public access through that link. A revoked share link SHALL NOT expose the note's content. Only the note's owner SHALL be able to revoke its share link.

#### Scenario: Note owner revokes an active share link

- **WHEN** a note owner revokes their note's active share link
- **THEN** the link becomes invalid for future public access

#### Scenario: Public visitor opens a revoked link

- **WHEN** a public visitor opens a share link that has been revoked
- **THEN** the shared note is not accessible

#### Scenario: Non-owner attempts to revoke the link

- **WHEN** an authenticated user who does not own the note attempts to revoke its share link
- **THEN** the operation is rejected

---

### Requirement: Public Share View Count

The system SHALL track the number of successful public views for each share link. Each successful public access to a share link SHALL increment the associated view count by exactly one. Concurrent successful views SHALL NOT cause lost view-count updates. Requests against an invalid, expired, or revoked share link SHALL NOT count as a successful view and SHALL NOT increment the view count.

#### Scenario: Valid public share link is successfully viewed

- **WHEN** a public visitor successfully views a note through a valid share link
- **THEN** the link's view count increases by one

#### Scenario: Multiple successful views occur concurrently

- **WHEN** multiple public visitors successfully view the same share link at the same time
- **THEN** the view count reflects every successful view with no lost updates

#### Scenario: Expired link is requested

- **WHEN** a public visitor requests an expired share link
- **THEN** the view count does not increase

#### Scenario: Revoked link is requested

- **WHEN** a public visitor requests a revoked share link
- **THEN** the view count does not increase

---

### Requirement: Sharing a Soft-Deleted Note

A soft-deleted note SHALL NOT remain publicly accessible through any of its share links. A public visitor requesting a share link whose underlying note is currently soft-deleted SHALL NOT receive the note's content.

#### Scenario: Active shared note is soft-deleted

- **WHEN** a note with an active share link is soft-deleted by its owner
- **THEN** the existing public link no longer exposes that note's content

#### Scenario: Public visitor requests a shared soft-deleted note

- **WHEN** a public visitor requests a share link whose underlying note is currently soft-deleted
- **THEN** the note's content is not returned
