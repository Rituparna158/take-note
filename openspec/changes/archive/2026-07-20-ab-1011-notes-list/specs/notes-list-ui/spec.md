## ADDED Requirements

### Requirement: Notes List Page

The frontend SHALL provide a notes list page for authenticated users at the protected `/` route, replacing the AB-1010 placeholder page. On mount, and whenever the active page, sort, or tag-filter selection changes, the page SHALL call `GET /api/notes` (using the existing `packages/shared` `listNotesQuerySchema`/`noteListResponseSchema`) and display the returned active notes, showing each note's title, tags, and timestamps. While a request is in flight, the page SHALL display visible loading feedback (FR-UI-NOTES-001).

#### Scenario: Authenticated user views their active notes

- **WHEN** an authenticated user navigates to `/`
- **THEN** `GET /api/notes` is called and the user's active notes are displayed with their titles, tags, and timestamps

#### Scenario: Loading feedback is shown while notes are being fetched

- **WHEN** a request to `GET /api/notes` (or `GET /api/tags`) is in flight
- **THEN** the page displays visible loading feedback until the request resolves

### Requirement: Notes Pagination Controls

The notes list page SHALL provide pagination controls driven by the `meta` object (`page`, `limit`, `totalCount`, `totalPages`) returned by `GET /api/notes`. Selecting a different page SHALL re-fetch and display the corresponding page of notes while preserving the current sort and tag-filter selection (FR-UI-NOTES-001, FR-NOTE-006).

#### Scenario: Changing page displays the corresponding notes

- **WHEN** a user with more notes than fit on one page selects another result page
- **THEN** `GET /api/notes` is called with the corresponding `page` value and the page displays that page's notes

### Requirement: Notes Sorting Controls

The notes list page SHALL provide controls for selecting `sortBy` (`createdAt` or `updatedAt`) and `sortOrder` (`asc` or `desc`). Changing either control SHALL re-fetch notes with the selected sort applied and update the displayed note order (FR-UI-NOTES-001, FR-NOTE-007).

#### Scenario: Changing sort updates the displayed note order

- **WHEN** a user changes the sort field or sort direction
- **THEN** `GET /api/notes` is called with the corresponding `sortBy`/`sortOrder` values and the displayed notes reflect the new order

### Requirement: Tag Filter Controls

The notes list page SHALL provide tag-filter controls populated from `GET /api/tags` (all of the authenticated user's tags), supporting selection of multiple tags. Selected tags SHALL be sent as the `tags` query parameter on `GET /api/notes`. When multiple tags are selected, only notes containing all selected tags SHALL be displayed (FR-UI-NOTES-001, FR-NOTE-008).

#### Scenario: Applying a single tag filter displays matching notes

- **WHEN** a user selects one tag from the tag-filter controls
- **THEN** `GET /api/notes` is called with that tag's ID in the `tags` parameter and only notes carrying that tag are displayed

#### Scenario: Applying multiple tag filters displays only notes matching all selected tags

- **WHEN** a user selects more than one tag from the tag-filter controls
- **THEN** `GET /api/notes` is called with all selected tag IDs in the `tags` parameter and only notes carrying every selected tag are displayed

### Requirement: Empty State Feedback

The notes list page SHALL display a visible empty-state message whenever `GET /api/notes` returns zero notes, whether because the authenticated user has no active notes at all or because none of their active notes match the current page/sort/tag-filter combination (FR-UI-NOTES-001).

#### Scenario: No notes exist for the user

- **WHEN** an authenticated user with zero active notes views the notes list page
- **THEN** a visible empty-state message is displayed instead of a notes list

#### Scenario: No notes match the current tag filter

- **WHEN** a user's selected tag-filter combination matches zero active notes
- **THEN** a visible empty-state message is displayed instead of a notes list

### Requirement: Authenticated Header and Logout

The notes list page SHALL display a minimal header showing the signed-in user's email and a logout control, carrying forward the logout capability removed from the AB-1010 placeholder page. Selecting logout SHALL call `POST /api/auth/logout`, clear the `AuthStore`, and navigate the user to `/login` (FR-UI-AUTH-001, FR-AUTH-004).

#### Scenario: Header displays the signed-in user's email

- **WHEN** an authenticated user views the notes list page
- **THEN** the header displays their email and a logout control

#### Scenario: Logout ends the session and returns to login

- **WHEN** an authenticated user selects the logout control on the notes list page
- **THEN** `POST /api/auth/logout` is called, the `AuthStore` is cleared, and the user is navigated to `/login`

### Requirement: Notes List Error Handling and Retry

The notes list page SHALL display a visible error alert whenever `GET /api/notes` or `GET /api/tags` fails (due to network failure or non-200 API response), and SHALL provide a working retry control allowing the user to re-trigger the request (FR-UI-NOTES-001).

#### Scenario: Failed fetch displays error feedback with retry control

- **WHEN** `GET /api/notes` fails due to a network or server error
- **THEN** a visible error alert is displayed with a retry control, and selecting retry re-triggers `GET /api/notes`
