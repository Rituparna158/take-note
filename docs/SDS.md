# Software Design Specification (SDS)

**Version:** 1.2
**Status:** Approved
**Date:** July 2026
**Project:** Note Taking App

This document defines the software design, database schemas, API contracts, search implementation, and technical constraints for the Note Taking Application. It acts as the technical companion to the Functional Requirements Specification (`FRS.md`).

---

## 1. System Architecture

The application is structured as a monorepo containing three workspaces managed by `pnpm`:

```
your-repo/
├── backend/            ← Express 5, Node.js 22, TypeScript, Prisma Client, Vitest, Supertest
├── frontend/           ← React 19, Vite, TanStack Query, Zustand, TipTap, TailwindCSS, Playwright
└── packages/shared/    ← Common Zod schemas, TypeScript types, validation rules
```

### 1.1 Key Architecture Rules
* **Type Isolation**: No database models or raw entities are exposed directly to the frontend. All data transferred over HTTP uses types and DTO schemas defined in `/packages/shared`.
* **Token Rotation**: Authentication uses short-lived JWT Access Tokens (15 min) passed in the `Authorization` header, and Refresh Tokens (7 days) stored in the database and sent to the client via secure, HTTP-only, SameSite cookies.
* **DB Operations**: All DB migrations are managed via Prisma CLI. Soft delete logic is implemented in application-level services to preserve note records for 30 days.
* **Account Deletion Caveat**: The current schema cascades `Note`, `Tag`, and `RefreshToken` deletion when a `User` row is hard-deleted (see §2.1). Account deletion is out of scope for this project, so this cannot currently be triggered by any endpoint — but if account deletion is added in the future, this cascade would bypass the 30-day note recovery window and must be revisited at that time.
* **API Versioning**: There is no API versioning in v1. All endpoints are prefixed directly with `/api`.
* **Middleware Execution Order**: Express middlewares in the backend run in this exact order:
  1. `helmet()` — set security headers
  2. `cors({ origin: process.env.WEB_ORIGIN, credentials: true })` — handle cross-origin requests
  3. `express.json()` — parse incoming JSON body payloads
  4. `cookieParser()` — parse cookies (specifically for HTTP-only refresh tokens)
  5. `requestLogger` (Pino-http) — log requests
  6. Rate limiters (`express-rate-limit`)
  7. Authentication middleware (`authenticateToken` — JWT verification)
  8. API routes (`/api/auth`, `/api/notes`, etc.)
  9. Global error handler (`errorHandler`)

---

## 2. Database Schema (Prisma)

The application uses PostgreSQL 16. To facilitate rich-text integration with TipTap, `Note.content` and `NoteVersion.content` are stored as `Json`. Search indexing and queries run against `bodyText` (the extracted plain-text version of the Note's content). The Prisma schema is defined as follows:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id              String         @id @default(uuid())
  email           String         @unique // Handled case-insensitively at the application layer
  passwordHash    String
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  resetOtpHash    String?        // Securely hashed password reset OTP
  resetOtpExpires DateTime?
  notes           Note[]
  tags            Tag[]
  refreshTokens   RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  tokenHash String   @unique // Cryptographically hashed (SHA-256) refresh token
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Note {
  id         String        @id @default(uuid())
  title      String
  content    Json          // Store TipTap editor JSON document representation
  bodyText   String        @db.Text // Extracted plain-text content used for search indexing
  userId     String
  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  deletedAt  DateTime?     // Null = active, Timestamp = soft-deleted
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  tags       NoteTag[]
  versions   NoteVersion[]
  shareLinks ShareLink[]

  @@index([userId])
  @@index([deletedAt])
  @@index([createdAt])
  @@index([updatedAt])
}

model Tag {
  id        String    @id @default(uuid())
  name      String
  color     String
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  notes     NoteTag[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([name, userId]) // Tag names unique per user
}

model NoteTag {
  noteId String
  note   Note   @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tagId  String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
}

model ShareLink {
  id        String    @id @default(uuid())
  noteId    String
  note      Note      @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tokenHash String    @unique // Hashed (SHA-256) version of the public token
  expiresAt DateTime  // Expiration date (defaults to 7 days from generation)
  viewCount Int       @default(0)
  revoked   Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([noteId])
}

model NoteVersion {
  id        String   @id @default(uuid())
  noteId    String
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  title     String
  content   Json     // TipTap editor JSON snapshot
  bodyText  String   @db.Text // Plain-text content snapshot
  version   Int      // Incremental version number starting at 1
  savedAt   DateTime @default(now()) // Timestamp of snapshot creation
}
```

### 2.1 Cascade Deletion & Purging Logic

* When a `User` is deleted, all their `notes`, `tags`, and `refreshTokens` are cascaded and physically removed from the DB. (See the Account Deletion Caveat in §1.1 — this path is not currently reachable through any endpoint.)
* When a `Note` is permanently purged (see below), all related `NoteTag` associations, `ShareLink` records, and `NoteVersion` records are deleted automatically via Cascade constraints.
* **Two independent scheduled cron jobs** perform the only scheduled physical deletions in the system, both running on the same daily schedule (`PURGE_CRON_SCHEDULE`), each logging the count of rows purged:
  * `purgeNotes.ts` — permanently deletes `Note` records where `deletedAt <= NOW() - INTERVAL '30 days'`. This is what makes a soft-deleted note actually unrestorable once its recovery window has elapsed (FR-NOTE-009). Cascades remove associated `NoteTag`, `ShareLink`, and `NoteVersion` rows.
  * `purgeVersions.ts` — permanently deletes `NoteVersion` records where `savedAt <= NOW() - INTERVAL '90 days'`, independent of note deletion state (FR-VER-005).

> **Note:** version retention (90 days) and note recovery window (30 days) are independent and intentionally different periods — do not conflate the two purge jobs.

### 2.2 Dual-Database Migrations

Every migration is applied to both `notes_dev` (`DATABASE_URL`) and `notes_test` (`TEST_DATABASE_URL`) — the same migration files are run twice against the two connection strings.

---

## 3. API Contracts & Conventions

All success responses return JSON content. Error responses adhere to a consistent JSON layout:
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error description",
  "fields": { "fieldName": "Field-specific validation issue" } // Optional, for validation failures
}
```

**Standard Error Codes:**
* `VALIDATION_ERROR`: Request payload failed Zod schema checks.
* `UNAUTHORIZED`: Authentication missing or failed (bad JWT/expired).
* `FORBIDDEN`: User does not own the requested resource.
* `NOT_FOUND`: Resource does not exist (or has been soft-deleted/purged).
* `CONFLICT`: Resource name or constraint conflict (e.g. duplicate tag name).
* `RATE_LIMIT_EXCEEDED`: Exceeded request rate limit threshold.
* `INTERNAL_SERVER_ERROR`: Generic system failure.

---

### 3.1 Authentication endpoints (`/api/auth`)

#### 3.1.1 `POST /api/auth/register`
* **Purpose**: Register a new user account.
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123"
  }
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "uuid-string",
      "email": "user@example.com"
    }
  }
  ```
* **Cookie Set**: `refreshToken` (HTTP-only, Secure, SameSite=Strict, Max-Age=7 days).
* **Behavior**: Email uniqueness check is case-insensitive (e.g., lowercased at the application layer).
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `422 Unprocessable Entity` (`CONFLICT` - Email already registered), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

#### 3.1.2 `POST /api/auth/login`
* **Purpose**: Authenticate user and issue tokens.
* **Request Body**: Same as Register.
* **Success Response (`200 OK`)**: Same as Register.
* **Cookie Set**: `refreshToken` (HTTP-only, Secure, SameSite=Strict, Max-Age=7 days).
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED` - Invalid email or password), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

#### 3.1.3 `POST /api/auth/logout`
* **Purpose**: End the current session and invalidate the refresh token.
* **Headers**: `Authorization: Bearer <accessToken>`
* **Success Response (`200 OK`)**:
  ```json
  { "message": "Logged out successfully" }
  ```
* **Cookie Set**: Clears `refreshToken` cookie (expired Max-Age=0).
* **Behavior**: Extracts cookie, hashes it using SHA-256, and physically deletes the corresponding `RefreshToken` row from the database.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

#### 3.1.4 `POST /api/auth/refresh`
* **Purpose**: Rotate tokens using refresh credentials.
* **Cookies**: `refreshToken` must be present.
* **Success Response (`200 OK`)**:
  ```json
  {
    "accessToken": "new-access-token"
  }
  ```
* **Cookie Set**: Refreshed `refreshToken` (token rotation).
* **Behavior**: 
  * Checks cookie, hashes it with SHA-256, and queries database.
  * Refresh token rotation invalidates the previous refresh token and stores the new token hash (Token Rotation).
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

#### 3.1.5 `POST /api/auth/forgot-password`
* **Purpose**: Generate and log OTP code for password recovery.
* **Request Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  { "message": "If this email is registered, a password reset code has been generated." }
  ```
* **Behavior**: 
  * Checks if user exists. If yes, generates a 6-digit OTP string.
  * Hashes OTP with SHA-256 (`resetOtpHash`) and updates `resetOtpExpires` (+15 min) in the user record.
  * Logs the plaintext OTP code to the server console (simulating delivery).
  * If user does not exist, performs no database write but returns the same payload & status code (anti-enumeration measure).
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

#### 3.1.6 `POST /api/auth/reset-password`
* **Purpose**: Reset password using OTP.
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "otp": "123456",
    "newPassword": "NewSecurePassword123"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  { "message": "Password reset successful" }
  ```
* **Behavior**: 
  * Hashes incoming OTP using SHA-256.
  * Verifies it matches `resetOtpHash` and is not expired.
  * Hashes `newPassword` (bcrypt) and updates the User record.
  * Clears `resetOtpHash` and `resetOtpExpires` to prevent reuse.
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR` / `UNAUTHORIZED` - Invalid or expired OTP), `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`).

---

### 3.2 Notes endpoints (`/api/notes`)
All endpoints in this section require a valid `Authorization: Bearer <token>` header.

#### 3.2.1 `POST /api/notes`
* **Purpose**: Create a note.
* **Request Body**:
  ```json
  {
    "title": "My Note",
    "content": { "type": "doc", "content": [...] }, // TipTap JSON object
    "tagIds": ["uuid-tag-1"]
  }
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "id": "uuid-note",
    "title": "My Note",
    "content": { "type": "doc", "content": [...] },
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-16T12:00:00Z",
    "tags": [{ "id": "uuid-tag-1", "name": "Work", "color": "#ff0000" }]
  }
  ```
* **Behavior**: 
  * Parses plain text from content JSON to save in the `bodyText` field.
  * Automatically saves an initial `NoteVersion` (version=1, content=JSON, bodyText=extracted plain text).
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized` (`UNAUTHORIZED`), `422 Unprocessable Entity` (`CONFLICT` - a supplied tag ID does not belong to the user).

#### 3.2.2 `GET /api/notes`
* **Purpose**: Get paginated list of active notes.
* **Query Parameters**:
  * `page` (default: 1)
  * `limit` (default: 10)
  * `sortBy` (`createdAt` or `updatedAt`, default: `updatedAt`)
  * `sortOrder` (`asc` or `desc`, default: `desc`)
  * `tags` (optional, comma-separated list of Tag IDs. Returns notes containing **all** specified tags — AND semantics, per FR-NOTE-008).
* **Success Response (`200 OK`)**:
  ```json
  {
    "data": [
      {
        "id": "uuid-note",
        "title": "My Note",
        "content": { "type": "doc", "content": [...] },
        "createdAt": "...",
        "updatedAt": "...",
        "tags": [{ "id": "uuid-tag-1", "name": "Work", "color": "#ff0000" }]
      }
    ],
    "meta": {
      "totalCount": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR` - invalid pagination/sort parameters), `401 Unauthorized` (`UNAUTHORIZED`).

#### 3.2.3 `GET /api/notes/:id`
* **Purpose**: Retrieve note details.
* **Success Response (`200 OK`)**: Note object with tags.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

#### 3.2.4 `PUT /api/notes/:id`
* **Purpose**: Update note title, content, and tags.
* **Request Body**:
  ```json
  {
    "title": "Updated Title",
    "content": { "type": "doc", "content": [...] },
    "tagIds": ["uuid-tag-1"]
  }
  ```
* **Success Response (`200 OK`)**: Updated note object.
* **Behavior**: 
  * Extracts plain-text representation of TipTap JSON into `bodyText`.
  * Compares changes. If title or content changes exist, saves a new `NoteVersion` snapshot incrementing the version number.
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

#### 3.2.5 `DELETE /api/notes/:id`
* **Purpose**: Soft delete a note.
* **Success Response (`200 OK`)**:
  ```json
  { "message": "Note moved to trash successfully" }
  ```
* **Behavior**: Sets `deletedAt = NOW()`. Note is kept in DB but excluded from active note queries.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

#### 3.2.6 `POST /api/notes/:id/restore`
* **Purpose**: Restore a soft-deleted note.
* **Success Response (`200 OK`)**:
  ```json
  { "message": "Note restored successfully" }
  ```
* **Behavior**: Sets `deletedAt = null`. Note becomes active immediately.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND` - note has been purged or does not exist).

---

### 3.3 Tags endpoints (`/api/tags`)
Requires a valid `Authorization` header.

#### 3.3.1 `POST /api/tags`
* **Request Body**:
  ```json
  {
    "name": "Personal",
    "color": "#00ff00"
  }
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "id": "uuid-tag",
    "name": "Personal",
    "color": "#00ff00"
  }
  ```
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized` (`UNAUTHORIZED`), `422 Unprocessable Entity` (`CONFLICT` - Tag name already exists in this user's scope).

#### 3.3.2 `GET /api/tags`
* **Purpose**: Retrieve all user-scoped tags with active note count.
* **Success Response (`200 OK`)**:
  ```json
  [
    {
      "id": "uuid-tag",
      "name": "Personal",
      "color": "#00ff00",
      "_count": {
        "notes": 5 // Only counts active notes (where deletedAt is null)
      }
    }
  ]
  ```
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`).

#### 3.3.3 `PUT /api/tags/:id`
* **Request Body**:
  ```json
  {
    "name": "Personal Updated",
    "color": "#0000ff"
  }
  ```
* **Success Response (`200 OK`)**: Updated tag object.
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`), `422 Unprocessable Entity` (`CONFLICT` - name collision).

#### 3.3.4 `DELETE /api/tags/:id`
* **Purpose**: Delete a tag.
* **Success Response (`200 OK`)**:
  ```json
  { "message": "Tag deleted successfully" }
  ```
* **Behavior**: Deletes tag record. All relationships in `NoteTag` are cascadingly deleted. The actual notes are unchanged.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

---

### 3.4 Search endpoint (`/api/search`)
Requires a valid `Authorization` header.

#### 3.4.1 `GET /api/search`
* **Query Parameters**:
  * `q` (search keywords)
  * `page` (default: 1)
  * `limit` (default: 10)
* **Success Response (`200 OK`)**:
  ```json
  {
    "data": [
      {
        "id": "uuid-note",
        "title": "Highlighted Title Match",
        "content": { "type": "doc", "content": [...] },
        "createdAt": "...",
        "updatedAt": "...",
        "tags": [],
        "highlight": "Highlighted <mark>keyword</mark> content snippet..."
      }
    ],
    "meta": {
      "totalCount": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR` - missing or empty `q`), `401 Unauthorized` (`UNAUTHORIZED`).

---

### 3.5 Sharing endpoints (`/api/notes/:id/share` and `/api/share`)

#### 3.5.1 `POST /api/notes/:id/share` (Auth required)
* **Purpose**: Generate a new read-only share link for a note.
* **Request Body**:
  ```json
  {
    "expiresInDays": 14 // Optional. Integer, 1–30. If absent, applies default of 7 days.
  }
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "shareLink": "http://localhost:5173/share/plaintext-token-uuid",
    "expiresAt": "2026-07-30T00:00:00Z",
    "viewCount": 0,
    "revoked": false
  }
  ```
* **Behavior**: 
  * Generates a plaintext cryptographically secure token UUID.
  * Hashes it with SHA-256 (`tokenHash`) and writes it to database.
  * The endpoint returns the plaintext token inside the url *only once*.
  * Revokes prior share links associated with the note (setting `revoked = true`) so only one token is ever active at any time.
* **Errors**: `400 Bad Request` (`VALIDATION_ERROR`), `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

#### 3.5.2 `DELETE /api/notes/:id/share` (Auth required)
* **Purpose**: Revoke the note's currently active public share link.
* **Success Response (`200 OK`)**:
  ```json
  { "message": "Share link revoked successfully" }
  ```
* **Behavior**: Sets `revoked = true` on the currently active `ShareLink` row for the note.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

#### 3.5.3 `GET /api/share/:token` (Public — No Auth)
* **Purpose**: Access note content via public link.
* **Success Response (`200 OK`)**:
  ```json
  {
    "title": "Public Note Title",
    "content": { "type": "doc", "content": [...] }, // TipTap JSON
    "updatedAt": "2026-07-16T12:00:00Z"
  }
  ```
* **Behavior**: 
  * Hashes input `:token` with SHA-256, looks it up in `ShareLink` table.
  * Validates link exists, is not revoked, is not expired, and the note is not soft-deleted.
  * On success, atomically increments `viewCount` (`UPDATE ... SET "viewCount" = "viewCount" + 1`) to prevent concurrent view count overrides.
* **Errors**: `403 Forbidden` (`FORBIDDEN` - expired or revoked), `404 Not Found` (`NOT_FOUND` - token does not exist / note purged).

---

### 3.6 Version history endpoints (`/api/notes/:id/versions`)
Requires a valid `Authorization` header.

#### 3.6.1 `GET /api/notes/:id/versions`
* **Purpose**: List historical version snapshots.
* **Success Response (`200 OK`)**:
  ```json
  [
    {
      "id": "uuid-version-1",
      "version": 1,
      "title": "Original Note Title",
      "savedAt": "2026-07-16T12:00:00Z"
    }
  ]
  ```
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

#### 3.6.2 `GET /api/notes/:id/versions/:versionId`
* **Purpose**: View specific version details.
* **Success Response (`200 OK`)**: Version snapshot object including TipTap JSON content.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND` - version purged or missing).

#### 3.6.3 `POST /api/notes/:id/versions/:versionId/restore`
* **Purpose**: Restore selected historical version.
* **Success Response (`200 OK`)**:
  ```json
  {
    "id": "uuid-note",
    "title": "Original Note Title",
    "content": { "type": "doc", "content": [...] },
    "version": 2 // Increments version counter
  }
  ```
* **Behavior**: Creates a new `NoteVersion` snapshot using the restored content and updates the current `Note` row. All historical snapshot lines remain unchanged.
* **Errors**: `401 Unauthorized` (`UNAUTHORIZED`), `403 Forbidden` (`FORBIDDEN`), `404 Not Found` (`NOT_FOUND`).

---

## 4. PostgreSQL Full-Text Search Strategy

Instead of standard, slow `ILIKE` operations, search queries use PostgreSQL's native Full-Text Search.

### 4.1 Search Query Mechanics
To avoid syncing tables to an external elastic search provider, we run PostgreSQL text vector logic directly. A Prisma raw query implements keyword match and highlighting against `Note.bodyText` (plain-text content):

```sql
SELECT 
  n.id, 
  n.title, 
  n.content, 
  n."createdAt", 
  n."updatedAt",
  ts_headline('english', n."bodyText", plainto_tsquery('english', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, ShortWord=3') AS highlight
FROM "Note" n
WHERE 
  n."userId" = $2 
  AND n."deletedAt" IS NULL 
  AND (
    to_tsvector('english', n.title || ' ' || n."bodyText") @@ plainto_tsquery('english', $1)
  )
ORDER BY ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), plainto_tsquery('english', $1)) DESC
LIMIT $3 OFFSET $4;
```

A precomputed `tsvector` column with a GIN index backs this query (see §6.1) so the search resolves quickly.

### 4.2 Search Highlights
* The search highlights use HTML `<mark>` tags around matched words.
* The frontend safely renders the search snippet in the UI interface (using `DOMPurify` to sanitize HTML content).

---

## 5. Rate Limiting Rules

Endpoints are rate-limited via `express-rate-limit` to prevent denial-of-service and brute-force requests. Per NFR-008, exceeding any limit below returns `429 Too Many Requests`.

| Limiter                  | Targets                                                                 | Configuration                        | Keyed On |
| ------------------------- | ------------------------------------------------------------------------| ---------------------------------------| --------- |
| Registration              | `POST /api/auth/register`                                              | 3 requests / hour                     | IP        |
| Login                     | `POST /api/auth/login`                                                 | 5 requests / minute                    | IP        |
| Token Refresh             | `POST /api/auth/refresh`                                               | 20 requests / minute                    | IP        |
| Logout                    | `POST /api/auth/logout`                                                | 20 requests / minute                    | IP        |
| Forgot Password           | `POST /api/auth/forgot-password`                                       | 3 requests / hour                      | Email     |
| Reset Password            | `POST /api/auth/reset-password`                                        | 5 requests / minute                    | IP        |
| Public Share Access       | `GET /api/share/:token`                                                | 60 requests / minute                    | IP + Token|
| Standard Authenticated API| `/api/notes/*`, `/api/tags/*`, `/api/search`                           | 1000 requests / 15 minutes              | Session ID|

---

## 6. Performance & Indexing

### 6.1 Database Indexing
* `Note.userId` — indexed to quickly fetch a user's active notes.
* `Note.deletedAt` — indexed to make active-note filtering (`WHERE "deletedAt" IS NULL`) efficient at scale.
* A generated `tsvector` column on `Note` (combining `title` and `bodyText`) backed by a **GIN index** supports the full-text search query.
* `Tag(name, userId)` — unique composite index. A case-insensitive functional index (`LOWER(name)`) is added via raw migration for case-insensitive check.
* `ShareLink.noteId` — indexed to look up active share links.

### 6.2 Tag Note-Count Aggregation
Tag active-note counts (`GET /api/tags`) are computed via a single aggregated query (a `COUNT` over `NoteTag` joined to `Note` filtered on `deletedAt IS NULL`, grouped by tag) to prevent N+1 query loops.

### 6.3 Connection Pooling
Prisma connection pooling is managed via connection string parameters in the environment files (e.g. `connection_limit=10`).

---

## 7. Data Migration Strategy

* **Prisma Migrations**: Schema alterations expressible in the Prisma schema file are deployed via `npx prisma migrate dev`.
* **Raw SQL Dependencies**: Generated search vectors and functional lower indexes are deployed using a raw SQL `--create-only` Prisma migration file.
* **Historical Data Purge**: See §2.1 for cron jobs (`purgeNotes.ts` and `purgeVersions.ts`).
* **Dual-Database Migrations**: See §2.2.

---

## 8. Environment Configuration

The application expects the following variables to be configured:

```
# Core Server Configuration
PORT=3000
NODE_ENV=development # development | production | test
WEB_ORIGIN=http://localhost:5173

# Database Connection URLs
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notes_dev?schema=public&connection_limit=10"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/notes_test?schema=public&connection_limit=10"

# Security Configuration
JWT_SECRET="super-secret-jwt-signing-key"

# Background Job Configuration
PURGE_CRON_SCHEDULE="0 0 * * *" # Daily at midnight
```

---

## 9. Logging Setup

The application uses **Pino** and **Pino-http** for low-overhead logging.

* **Log Redactions**: To prevent leakage of personal details and tokens, the logger is configured to redact the following object paths:
  * `req.headers.authorization`
  * `req.headers.cookie`
  * `req.body.password`
  * `req.body.newPassword`
  * `req.body.otp`
* **Log Levels**: Configured to `info` in production and `debug` in development/testing.

---

## 10. Express Middleware Order

The request pipeline matches this strict, linear middleware execution stack:

```mermaid
graph TD
    A[Client Request] --> B[Helmet: Security Headers]
    B --> C[CORS Config: Origin Check]
    C --> D[express.json: Body Parser]
    D --> E[cookieParser: Cookie Parser]
    E --> F[Pino requestLogger]
    F --> G[express-rate-limit: Rate Limiter]
    G --> H[authenticateToken: Auth Check]
    H --> I[API Router]
    I --> J[Global Error Handler]
```

---

## 11. Frontend State & UI Architecture

The React application implements a split state-management architecture:

### 11.1 TanStack Query (Server State)
* Manages pagination, sorting, search keyword caching, tag list data, and server mutation lifecycles.
* Implements automatic caching invalidation triggers. For instance, updating a note invalidates its specific query cache key and the notes paginated cache key.

### 11.2 Zustand (Client UI State)
Stores UI-specific values using lightweight stores:
* **AuthStore**: Tracks JWT `accessToken`, current `user` object, and functions like `login()`, `logout()`, and `renewSession()`.
* **NoteStore**: Tracks the ID of the note currently open in the editor, and unsaved draft state.
* **EditorStore**: Handles rich-text editor instances, autosave state tracking, and error retry state management.

### 11.3 Note Autosave Mechanics
* **Trigger Debounce**: The frontend triggers an automatic save (PUT request to `/api/notes/:id`) after exactly **2 seconds** of user editor inactivity (debounce duration).
* **Retry Strategy**: If an autosave request fails, the application automatically retries the operation up to **three times** using an exponential backoff strategy (delaying 1s, then 2s, then 4s between attempts).
* **Notification**: An error toast/notification is presented to the user only after all three retry attempts are exhausted. While retrying, a subtle loading/retrying indicator is shown in the editor footer without blocking the user.

---

## 12. Docker Setup

A root `docker-compose.yml` configures two isolated PostgreSQL services to run during local development and automated testing:

```yaml
version: '3.8'

services:
  notes_dev:
    image: postgres:16-alpine
    container_name: notes_dev
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes_dev
    volumes:
      - pg_data_dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d notes_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  notes_test:
    image: postgres:16-alpine
    container_name: notes_test
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: notes_test
    volumes:
      - pg_data_test:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d notes_test"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pg_data_dev:
  pg_data_test:
```

---

## 13. Testing Configuration

The test suite ensures high software reliability and covers 100% of defined scenarios.

* **Backend Integration Testing**: Runs via **Vitest** and **Supertest** targeting the isolated `notes_test` database (port 5433).
* **Test Isolation**: Every test suite runs inside a transaction that is rolled back at the end of the test, or uses DB truncation scripts before running to keep tests independent.
* **Frontend Component Testing**: Vitest and React Testing Library mock backend API endpoints using MSW (Mock Service Worker).
* **End-to-End Testing**: Browser-based flow testing runs via **Playwright** against a local instance, verifying the entire registration-to-sharing lifecycle.
* **Scenario-to-Test Mapping**: Every Acceptance Criteria scenario defined in the `FRS.md` maps to exactly one uniquely named automated test in the codebase to ensure complete traceable coverage.

---

## 14. AI Workflow & Code Quality Infrastructure

The codebase integrates specific configurations to enforce rules and automate checks:

### 14.1 Quality Check Verification Sequence
During check checkpoints or manual reviews, the development pipeline verifies the code using the following strict sequence. If any step fails, verification halts immediately, and the developer must resolve the error before continuing:
1. `pnpm build` (compilation checks) — must finish with 0 warnings, 0 errors.
2. `pnpm lint --max-warnings 0` (code analysis) — must pass cleanly.
3. `pnpm test` (automated test runner) — all unit, integration, and E2E tests must pass.

### 14.2 Git Hooks Configuration
Git hooks are managed via **Husky** and **lint-staged**:
* **pre-commit hook**: Runs `lint-staged` which executes `pnpm lint` (code quality analysis), `prettier --write` (formatting), and typechecks matching workspaces (`tsc --noEmit`).
* **commit-msg hook**: Runs `npx commitlint --edit` to validate commit messages.

### 14.3 Commit Conventions & Azure Boards Mapping
Commits must adhere to the Conventional Commits specification. Additionally, `feat` and `fix` commits must include an Azure Boards ticket number (e.g. `AB#ticket` or `AB-ticket`). Commitlint rules enforce this format at the hook layer:
* Format: `feat(scope): implementation description AB#1001` or `fix(auth): correct token rotation bug AB-1002`

### 14.4 OpenSpec Workflows
* **OpenSpec Delta**: Changes to APIs and specifications are documented as per-ticket proposals in the `openspec/changes/` directory.
* **Archive Phase**: Before raising a pull request, the active ticket proposal must be successfully archived (`openspec archive AB-xxxx`), moving it from `changes/` to `archive/` to preserve a history log.

### 14.5 Developer Context Management & Git Worktrees
* **Worktree Separation**: Independent parallel development tasks (such as parallel frontend and backend implementations) must be executed in separate Git worktrees.
* **Context Maintenance**: The developer session context must be cleared (`/clear`) between tickets and compacted when context usage reaches approximately 70% to prevent context bloat.
* **Tooling Checks**: The `context7` MCP tool must be used to verify standard package documentation and libraries APIs against live documentation.