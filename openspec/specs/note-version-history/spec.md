# note-version-history Specification

## Purpose

TBD - created by archiving change ab-1009-version-history. Update Purpose after archive.

## Requirements

### Requirement: Save Note Version Snapshot

The system SHALL preserve note history through version snapshots. A note save that creates or updates note content SHALL create the required historical snapshot, preserving the note state needed for later version viewing and restoration.

#### Scenario: Existing note content is saved with changes

- **WHEN** an existing note's content is saved with changes
- **THEN** version history records the required snapshot

#### Scenario: Multiple note saves occur

- **WHEN** multiple saves occur over time for the same note
- **THEN** version history preserves the sequence of saved note states in order

---

### Requirement: List Note Versions

A note owner SHALL be able to list the available historical versions of their own note. A user SHALL NOT list version history for another user's private note. A soft-deleted note's version history SHALL NOT be listable until the note is restored, consistent with standard note read/update access rules.

#### Scenario: Note owner requests version history

- **WHEN** a note owner requests the version history of one of their own active notes
- **THEN** the available versions are returned

#### Scenario: Non-owner requests version history

- **WHEN** a user requests the version history of another user's note
- **THEN** the version history is not exposed and the request is rejected

#### Scenario: Version history is not listable for a soft-deleted note

- **WHEN** a user requests the version history of their own note while it is currently soft-deleted
- **THEN** the request is rejected as if the note does not exist

---

### Requirement: View Historical Version

A note owner SHALL be able to view a selected historical version of their own note. Viewing a historical version SHALL NOT modify the current note. A user SHALL NOT view a historical version belonging to another user's note. A soft-deleted note's historical versions SHALL NOT be viewable until the note is restored.

#### Scenario: Note owner selects an existing historical version

- **WHEN** a note owner selects one of their own note's existing historical versions
- **THEN** the historical note state for that version is returned

#### Scenario: Historical version is viewed

- **WHEN** a note owner views a historical version of their own note
- **THEN** the current note remains unchanged

#### Scenario: User requests another user's historical version

- **WHEN** a user requests a historical version belonging to another user's note
- **THEN** the historical content is not exposed and the request is rejected

#### Scenario: Historical version is not viewable for a soft-deleted note

- **WHEN** a user requests a historical version of their own note while it is currently soft-deleted
- **THEN** the request is rejected as if the note does not exist

---

### Requirement: Restore Historical Version

A note owner SHALL be able to restore a selected historical version of their own note. Version restoration SHALL NOT destructively remove existing version history. Restoring a historical version SHALL create a new current saved state for the note and preserve the full version timeline, including the version being restored from. Restoring a version whose title and content already match the note's current live state SHALL be permitted and SHALL still create a new version snapshot. A user SHALL NOT restore a historical version belonging to another user's note. A soft-deleted note's historical versions SHALL NOT be restorable until the note is restored.

#### Scenario: Note owner restores an existing version

- **WHEN** a note owner restores an existing historical version of their own note
- **THEN** the note reflects the restored title and content

#### Scenario: Historical version is restored

- **WHEN** a historical version is restored
- **THEN** a new version state is added to the timeline

#### Scenario: Version is restored

- **WHEN** a version is restored
- **THEN** existing historical versions, including the one restored from, remain available

#### Scenario: Restoring a version identical to the current state is permitted

- **WHEN** a note owner restores a historical version whose title and content already match the note's current live state
- **THEN** the restore succeeds and a new version snapshot reflecting that state is added to the timeline

#### Scenario: Non-owner attempts version restoration

- **WHEN** a user attempts to restore a historical version belonging to another user's note
- **THEN** the operation is rejected

#### Scenario: Version restoration is rejected for a soft-deleted note

- **WHEN** a user attempts to restore a historical version of their own note while it is currently soft-deleted
- **THEN** the operation is rejected as if the note does not exist

---

### Requirement: Automatic Version Purging

The system SHALL automatically purge historical note snapshots according to the configured version-retention period of 90 days. Version purging SHALL occur without requiring manual user action, on its own independent schedule, separate from note soft-delete purging. Purged historical snapshots SHALL no longer be available for viewing or restoration. Automatic purging SHALL apply strictly by snapshot age, with no exemption for a note's single newest snapshot, and MUST NOT delete the current note solely because of version retention.

#### Scenario: Historical snapshot exceeds the configured retention period

- **WHEN** a historical snapshot's saved timestamp is older than the configured 90-day retention period
- **THEN** the snapshot is automatically and permanently removed

#### Scenario: Historical snapshot is purged and cannot be viewed

- **WHEN** a historical snapshot has been purged
- **THEN** the snapshot cannot be viewed

#### Scenario: Historical snapshot is purged and cannot be restored

- **WHEN** a historical snapshot has been purged
- **THEN** the snapshot cannot be restored

#### Scenario: Version retention process runs

- **WHEN** the version retention purge process runs
- **THEN** the current note is not deleted because of snapshot retention, even if all of its historical snapshots are purged
