# search-ui Specification

## Purpose

TBD - created by archiving change ab-1013-search-ui. Update Purpose after archive.

## Requirements

### Requirement: Search Keyword Submission and Results Display

The frontend SHALL provide a note-search interface at the protected `/search` route. The interface SHALL provide a keyword input and an explicit submit action (Enter key or a Search button); submitting a non-empty keyword SHALL call `GET /api/search` (using the existing `packages/shared` `searchQuerySchema`/`searchResponseSchema`) and display the returned matching notes accessible to the authenticated user. Each displayed result SHALL be selectable, navigating to that note's editor route (`/notes/:id`) (FR-UI-SEARCH-001).

#### Scenario: Submitting a search keyword displays matching notes

- **WHEN** an authenticated user submits a search keyword
- **THEN** `GET /api/search` is called and the matching notes are displayed

#### Scenario: Selecting a search result opens it in the editor

- **WHEN** an authenticated user selects one of the displayed search results
- **THEN** the user is navigated to that note's editor route and the note opens for editing

### Requirement: Search Result Highlighting

Each search result SHALL display its `highlight` snippet, with the matched keyword visually distinguished. The snippet's `<mark>`-wrapped HTML SHALL be sanitized (via DOMPurify) before being rendered, so match information is presented safely (FR-UI-SEARCH-001).

#### Scenario: Search result contains visually distinguished match information

- **WHEN** a search result includes a highlighted match snippet
- **THEN** the matching keyword is visually distinguished within the rendered, sanitized snippet

### Requirement: Search Results Pagination

Search results SHALL support pagination, driven by the `meta` object (`page`, `limit`, `totalCount`, `totalPages`) returned by `GET /api/search`. Selecting a different result page SHALL re-fetch and display the corresponding page of results for the current keyword (FR-UI-SEARCH-001).

#### Scenario: Navigating search result pages displays the corresponding results

- **WHEN** a search returns more results than fit on one page and the user selects another result page
- **THEN** `GET /api/search` is called with the corresponding `page` value for the current keyword and that page's results are displayed

### Requirement: Search Empty State

The search page SHALL display a visible, appropriate empty-state message whenever a submitted keyword's search returns zero matching notes (FR-UI-SEARCH-001).

#### Scenario: Search returns no matching notes

- **WHEN** a submitted search keyword matches zero of the user's notes
- **THEN** a visible empty-state message is displayed instead of a results list

### Requirement: Search Idle State

Before any keyword has been submitted, the search page SHALL display an idle prompt state instead of a results list or empty-state message, and SHALL NOT call `GET /api/search`.

#### Scenario: Search page before any submission shows an idle prompt

- **WHEN** an authenticated user opens the search page without having submitted a keyword
- **THEN** an idle prompt state is displayed and no search request is made

### Requirement: Search Loading and Error Feedback

While a search request is in flight, the search page SHALL display visible loading feedback. If a search request fails (network failure or non-200 API response), the page SHALL display a visible error alert with a working retry control that re-submits the current keyword.

#### Scenario: Loading feedback is shown while a search is in flight

- **WHEN** a submitted search request to `GET /api/search` is in flight
- **THEN** the page displays visible loading feedback until the request resolves

#### Scenario: Failed search displays error feedback with retry control

- **WHEN** a search request to `GET /api/search` fails due to a network or server error
- **THEN** a visible error alert is displayed with a retry control, and selecting retry re-submits the current keyword

### Requirement: Search Entry Point

The existing authenticated header SHALL provide a "Search" navigation link to the `/search` route.

#### Scenario: Header provides navigation to the search page

- **WHEN** an authenticated user views the header on the notes list page
- **THEN** a "Search" navigation link is available that navigates to `/search`
