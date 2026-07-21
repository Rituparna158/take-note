# e2e-journey Specification

## Purpose

TBD - created by archiving change ab-1016-e2e-journey. Update Purpose after archive.

## Requirements

### Requirement: Complete Application User Journey

The application SHALL support an automated browser-based user journey covering the core application capabilities, executed using the configured end-to-end testing framework (Playwright) against the real backend and database. The journey SHALL validate interaction between the frontend and backend across registration, authentication, note management, tagging, search, sharing, version history, and logout.

#### Scenario: User completes the required core application journey

- **WHEN** a user registers a new account, logs in, creates a note, creates and assigns a tag to the note, filters the notes list by that tag, searches for the note by keyword, generates a public share link and views the note through it without authentication, edits the note, views and restores an earlier version through the version-history drawer, and logs out
- **THEN** registration, authentication, note management, tagging, search, sharing, version history, and logout capabilities work together successfully

#### Scenario: End-to-end journey executes without application errors

- **WHEN** the end-to-end journey described above executes in the browser
- **THEN** the browser-based test completes without any uncaught page errors or console errors being reported
