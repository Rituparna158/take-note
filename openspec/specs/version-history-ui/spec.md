# version-history-ui Specification

## Purpose

TBD - created by archiving change ab-1015-version-history-ui. Update Purpose after archive.

## Requirements

### Requirement: Version History Drawer

The note editor SHALL provide a version-history drawer for the currently open note, reachable from a "History" control shown once the note exists. Opening the drawer SHALL fetch and list the note's available historical versions (version number and saved date) via `GET /api/notes/:id/versions`. Selecting a listed version SHALL fetch and display that version's historical title and rich-text content read-only, inline within the drawer, via `GET /api/notes/:id/versions/:versionId`, without modifying the live editor's title, content, or unsaved state.

#### Scenario: Note owner opens version history

- **WHEN** a note owner opens the version-history drawer for their note
- **THEN** the version-history drawer is displayed

#### Scenario: Historical versions exist

- **WHEN** the note has one or more historical versions
- **THEN** the available versions are listed in the drawer, each showing its version number and saved date

#### Scenario: User selects a version

- **WHEN** a user selects one of the listed historical versions
- **THEN** that version's historical title and content are displayed read-only inline within the drawer

#### Scenario: User previews a version

- **WHEN** a user previews a historical version in the drawer
- **THEN** the current note's live editor title, content, and unsaved state remain unchanged

---

### Requirement: Restore Version Experience

The version-history drawer SHALL allow the note owner to restore a selected historical version by calling `POST /api/notes/:id/versions/:versionId/restore`. The restore action SHALL clearly identify the version selected for restoration (its version number) before it is invoked. Restoring SHALL NOT require a separate confirmation step beyond selecting the version and invoking the labeled restore action. On success, the editor's displayed title and content SHALL be updated to the restored version's state — discarding any unsaved live edits present at that moment — and the drawer SHALL close automatically. On failure, the restore action SHALL NOT be represented as successful, and the user SHALL receive visible error feedback within the drawer.

#### Scenario: User selects an available version for restoration

- **WHEN** a user selects an available historical version in the drawer
- **THEN** a restore action identifying that version's number is available

#### Scenario: Restore succeeds

- **WHEN** a note owner restores an available historical version and the restore succeeds
- **THEN** the current note display reflects the restored title and content, and the version-history drawer closes

#### Scenario: Restore fails

- **WHEN** a restore operation fails
- **THEN** the user receives visible error feedback in the drawer and the current note display is not changed
