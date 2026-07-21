# ui-polish Specification

## Purpose

Frontend visual and UX enhancements layered on top of AB-1001 through AB-1016, plus closure of three previously known UI gaps: the trash/soft-delete recovery UI, the tag-creation UI, and the public share view page. No database schema changes; two new read-only backend endpoints support the trash and share-status features.

## Requirements

### Requirement: Rich-Text Formatting Toolbar

The note editor SHALL provide an interactive formatting toolbar (`EditorToolbar.tsx`) above the editor canvas allowing the user to format content using Bold, Italic, Strikethrough, Code, Heading 1, Heading 2, Heading 3, Bullet List, Numbered List, Blockquote, Code Block, Undo, and Redo controls.

#### Scenario: User applies text formatting via toolbar

- **WHEN** a user clicks a formatting action button on the editor toolbar
- **THEN** the selected formatting mark or block node is toggled on the current editor selection, and the action button visually reflects its active state

#### Scenario: User toggles headings and lists via toolbar

- **WHEN** a user clicks heading or list buttons on the editor toolbar
- **THEN** the active line is formatted as the chosen heading or list node

---

### Requirement: Editor Title Placeholder & Layout Polish

The note editor SHALL provide a prominent, accessible title input with placeholder `"Note title..."` and styled focus indicators.

#### Scenario: User edits note title

- **WHEN** a user types into the note title input field
- **THEN** the note title is updated in local state and auto-saved to the server

---

### Requirement: Dynamic Autosave Status Pill

The note editor toolbar SHALL display a dynamic status pill indicating autosave state: `"Syncing changes..."` while saving, `"All changes saved"` when saved, and `"Sync failed — Retrying..."` on save error.

#### Scenario: Autosave status transitions

- **WHEN** note content or title changes are being auto-saved
- **THEN** the status pill displays `"Syncing changes..."`, transitioning to `"All changes saved"` once saved

---

### Requirement: Trash / Soft-Delete Recovery UI

The application SHALL provide a Trash Bin page (`TrashPage.tsx`, route `/trash`) listing the authenticated user's soft-deleted notes, backed by `GET /api/notes/trash`, and SHALL allow deleting a note from the active notes list (`DELETE /api/notes/:id`, already provided by AB-1004) and restoring a note from the Trash Bin (`POST /api/notes/:id/restore`, already provided by AB-1004).

#### Scenario: User deletes a note from the notes list

- **WHEN** a user clicks Delete on a note in the notes list and confirms the action
- **THEN** the note is soft-deleted and removed from the active notes list

#### Scenario: User views the trash bin

- **WHEN** a user navigates to the Trash Bin
- **THEN** their soft-deleted notes are listed, each showing its deletion date and a Restore Note action

#### Scenario: User restores a note from the trash bin

- **WHEN** a user clicks Restore Note on a trashed note
- **THEN** the note is restored to the active notes list and removed from the trash bin view

#### Scenario: Trash bin is empty

- **WHEN** a user with no soft-deleted notes views the Trash Bin
- **THEN** an empty state is shown with a link back to the notes list

---

### Requirement: Tag Creation UI

The `TagPicker.tsx` component SHALL allow creating a new tag inline via an "+ Add Tag" control, backed by the existing `POST /api/tags` endpoint (AB-1006), and SHALL automatically select the newly created tag on the current note.

#### Scenario: User creates a new tag from the tag picker

- **WHEN** a user enters a tag name via "+ Add Tag" and confirms
- **THEN** the tag is created and automatically applied to the current note

#### Scenario: User attempts to create a blank tag

- **WHEN** a user confirms tag creation with an empty or whitespace-only name
- **THEN** no request is sent and the tag is not created

---

### Requirement: Public Share View Page

The application SHALL provide a public, read-only page (`PublicSharePage.tsx`, route `/share/:token`) rendering the shared note's title and sanitized rich-text content via the existing `GET /api/share/:token` endpoint (AB-1008), requiring no authentication.

#### Scenario: Visitor opens a valid share link

- **WHEN** an unauthenticated visitor opens a valid, unexpired, unrevoked share link
- **THEN** the note's title and read-only content are displayed

#### Scenario: Visitor opens an invalid share link

- **WHEN** an unauthenticated visitor opens an expired, revoked, or nonexistent share link
- **THEN** an "Unable to view note" message is displayed instead of note content

---

### Requirement: Share Link Status Refresh & Copy

The `ShareModal.tsx` component SHALL allow copying the active share link to the clipboard and refreshing its live view count, backed by a new `GET /api/notes/:id/share` endpoint that returns the note owner's active (non-revoked, unexpired) share link status.

#### Scenario: Owner copies the share link

- **WHEN** a note owner clicks "Copy Link" on an active share link
- **THEN** the link is copied to the clipboard and the button confirms the copy

#### Scenario: Owner refreshes the view count

- **WHEN** a note owner clicks "Refresh Views" on an active share link
- **THEN** the displayed view count is updated to the current server-side value

#### Scenario: Owner has no active share link

- **WHEN** a note owner has never generated a share link, or their share link is revoked or expired
- **THEN** `GET /api/notes/:id/share` returns `404 NOT_FOUND`
