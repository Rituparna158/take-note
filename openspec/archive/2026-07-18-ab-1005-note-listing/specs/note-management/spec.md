## ADDED Requirements

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
