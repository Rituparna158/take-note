# database-foundation Specification

## Purpose

TBD - created by archiving change ab-1001-project-setup. Update Purpose after archive.

## Requirements

### Requirement: Prisma Schema Matches SDS Section 2

The backend SHALL define a Prisma schema containing exactly the models described in `docs/SDS.md` §2 — `User`, `RefreshToken`, `Note`, `Tag`, `NoteTag`, `ShareLink`, and `NoteVersion` — with the fields, relations, and cascade-delete behavior specified there. The generated `tsvector`/GIN full-text-search column and the case-insensitive functional index on `Tag(name, userId)` are explicitly out of scope for this schema and are added by the tickets that implement those features (search and tag management respectively).

#### Scenario: Prisma schema is inspected

- **WHEN** `backend/prisma/schema.prisma` is inspected
- **THEN** all seven models from SDS §2 are present with their documented fields, relations, and `onDelete: Cascade` behavior

#### Scenario: Prisma Client is generated

- **WHEN** `npx prisma generate` is run against the schema
- **THEN** a type-safe Prisma Client is generated with no errors

### Requirement: Dual-Database Migration Application

Every Prisma migration SHALL be applied to both the development database (`DATABASE_URL`, `notes_dev`) and the test database (`TEST_DATABASE_URL`, `notes_test`) using the same migration files, per SDS §2.2.

#### Scenario: Initial migration is applied

- **WHEN** a developer runs the project's dual-database migration command
- **THEN** the same initial migration is applied successfully to both `notes_dev` and `notes_test`

### Requirement: Base Query-Performance Indexes

The schema SHALL include the base indexes defined in SDS §2/§6.1 that do not depend on a not-yet-implemented feature: `Note.userId`, `Note.deletedAt`, `Note.createdAt`, `Note.updatedAt`, the unique composite `Tag(name, userId)`, and `ShareLink.noteId`.

#### Scenario: Schema indexes are inspected

- **WHEN** the generated migration SQL is inspected
- **THEN** indexes exist on `Note.userId`, `Note.deletedAt`, `Note.createdAt`, `Note.updatedAt`, the unique `Tag(name, userId)` composite, and `ShareLink.noteId`
