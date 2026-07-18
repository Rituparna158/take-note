# note-search Specification

## Purpose

TBD - created by archiving change ab-1007-note-search. Update Purpose after archive.

## Requirements

### Requirement: Full-Text Note Search

Authenticated users SHALL be able to search their own active notes using keywords via `GET /api/search`. Search SHALL consider both the note title and the note's rich-text content. Search SHALL return only notes owned by the authenticated user, and soft-deleted notes SHALL NOT appear in results. Search results SHALL support pagination using the same `{ data, meta }` envelope as the notes list endpoint. A missing or whitespace-only `q` query parameter SHALL be rejected.

#### Scenario: Search keyword matches a note title

- **WHEN** an authenticated user searches using a keyword that matches one of their note titles
- **THEN** the matching note is returned

#### Scenario: Search keyword matches note content

- **WHEN** an authenticated user searches using a keyword that matches the rich-text content of one of their notes
- **THEN** the matching note is returned

#### Scenario: Matching note belongs to another user

- **WHEN** a search keyword matches a note owned by a different user
- **THEN** that note is not returned to the searching user

#### Scenario: Matching note is soft-deleted

- **WHEN** a search keyword matches a note that is currently soft-deleted
- **THEN** that note is not returned

#### Scenario: Search returns more results than one page

- **WHEN** a search matches more notes than fit within one result page
- **THEN** results are returned across multiple pages using pagination

#### Scenario: Search request is missing a keyword

- **WHEN** an authenticated user submits a search request with a missing or whitespace-only `q` parameter
- **THEN** the request is rejected as a validation error

---

### Requirement: Search Result Highlighting

Search results SHALL identify matching keyword occurrences by providing highlighted match information suitable for visual presentation. Search highlighting SHALL NOT expose match information from notes inaccessible to the authenticated user.

#### Scenario: Keyword matches searchable note text

- **WHEN** a search keyword matches the searchable text of one of the user's own notes
- **THEN** the result includes highlighted match information for that note

#### Scenario: User views search results

- **WHEN** a user views their search results
- **THEN** the matching keyword can be visually distinguished within the result

#### Scenario: Another user's note contains the keyword

- **WHEN** a search keyword matches text within another user's note
- **THEN** no match or highlight information from that note is exposed to the searching user
