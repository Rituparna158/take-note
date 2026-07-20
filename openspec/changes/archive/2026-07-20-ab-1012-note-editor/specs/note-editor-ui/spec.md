## ADDED Requirements

### Requirement: Note Editor Routes and Content Loading

The frontend SHALL provide a rich-text note editor reachable at two routes inside the existing protected route wrapper: `/notes/new` for creating a note and `/notes/:id` for editing an existing active note. Opening `/notes/new` SHALL immediately call `POST /api/notes` (with a default title of `"Untitled"` and an empty TipTap document) and continue as the editor for the newly created note. Opening `/notes/:id` SHALL call `GET /api/notes/:id` and load the note's existing title, rich-text content, and assigned tags into the editor (FR-UI-EDITOR-001).

#### Scenario: Creating a new note opens the rich-text editor

- **WHEN** an authenticated user creates a new note
- **THEN** `POST /api/notes` is called and rich-text editing is available for the newly created note

#### Scenario: Opening an existing note loads its content into the editor

- **WHEN** an authenticated user opens one of their own active notes for editing
- **THEN** `GET /api/notes/:id` is called and the note's existing content is available in the editor

### Requirement: Editor Entry Points from the Notes List

The notes list page SHALL provide a "New Note" action and SHALL make each displayed note selectable, navigating to that note's editor route. This delivers the entry points into the note editor deferred by AB-1011 (FR-UI-EDITOR-001).

#### Scenario: New Note action opens the editor for a new note

- **WHEN** an authenticated user selects the "New Note" action on the notes list page
- **THEN** the user is navigated to the note editor for a newly created note

#### Scenario: Selecting a note in the list opens it in the editor

- **WHEN** an authenticated user selects one of their notes on the notes list page
- **THEN** the user is navigated to that note's editor route and the note opens for editing

### Requirement: Rich-Text Content Changes and Tag Assignment

The editor SHALL allow the user to change a note's rich-text content, with changes saved through the note's autosave behavior. The editor SHALL provide a tag picker sourced from `GET /api/tags`, letting the user assign or unassign any of their existing tags on the note; selected tag IDs SHALL be included in the note's save payload (FR-UI-EDITOR-001).

#### Scenario: Changed rich-text content can be saved

- **WHEN** a user changes the rich-text content of their open note
- **THEN** the updated content is saved through the note's autosave behavior

#### Scenario: Assigning an accessible tag associates it with the note

- **WHEN** a user selects one of their existing tags in the editor's tag picker
- **THEN** the tag is associated with the note on save

### Requirement: Pasted Content Sanitization

Rich-text content in the editor SHALL be presented safely. Content pasted into the editor SHALL be sanitized (via DOMPurify) before insertion; typed content and content loaded from the API SHALL remain constrained to the editor's rich-text node schema, which does not include a raw-HTML node. Unsafe executable content SHALL NOT be executed during display (FR-UI-EDITOR-001).

#### Scenario: Pasted HTML content is sanitized before insertion

- **WHEN** a user pastes HTML content containing executable script markup into the editor
- **THEN** the pasted content is sanitized before being inserted, and the unsafe markup is not executed when displayed

### Requirement: Note Autosave Trigger

The editor SHALL automatically save changed note content via `PUT /api/notes/:id` after exactly 2 seconds of user inactivity following a real content or title change. The editor SHALL NOT perform an autosave when no relevant content has changed since the last save (FR-UI-EDITOR-002).

#### Scenario: Changed content is automatically saved after inactivity

- **WHEN** a user changes note content and stops editing for 2 seconds
- **THEN** `PUT /api/notes/:id` is called automatically with the updated content

#### Scenario: Unnecessary autosave is not performed

- **WHEN** 2 seconds of inactivity elapse with no content change since the last successful save
- **THEN** no autosave request is sent

### Requirement: Autosave Save-State Feedback

When an autosave completes successfully, the editor SHALL provide a visible indication that the user can use to identify the note is in a saved state (FR-UI-EDITOR-002).

#### Scenario: Successful autosave is identifiable to the user

- **WHEN** an autosave completes successfully
- **THEN** the editor displays a visible indication that the note is saved

### Requirement: Autosave Retry and Failure Feedback

When an autosave request fails, the application SHALL automatically retry it up to three times using a 1s, then 2s, then 4s backoff before notifying the user, showing a quiet, non-blocking retrying indicator in the meantime. Only after all retry attempts are exhausted SHALL the user receive visible failure feedback; a failed autosave SHALL NOT be represented as successfully saved (FR-UI-EDITOR-002).

#### Scenario: Autosave retries before notifying the user of failure

- **WHEN** an autosave request fails
- **THEN** the application automatically retries the autosave with 1s, then 2s, then 4s backoff before showing any failure feedback

#### Scenario: Autosave failure is shown after retries are exhausted

- **WHEN** all autosave retry attempts fail
- **THEN** the user receives visible failure feedback and the note is not represented as successfully saved
