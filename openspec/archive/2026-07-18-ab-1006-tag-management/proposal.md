## Why

Users need a way to organize their notes with user-scoped labels. The `Tag` and `NoteTag` tables already exist in the schema (from AB-1001), and AB-1005 already added tag-based note _filtering_, but there is still no way for a user to create, list, rename, or delete a tag, and no way to attach a tag to a note. AB-1006 closes that gap: it delivers full tag CRUD with active-note counts (FR-TAG-001..004), and wires tag assignment into note creation and updates so the association is actually usable end-to-end.

## What Changes

- Add `POST /api/tags` — create a user-scoped tag (name + color); rejects a name that collides case-insensitively with the user's own existing tag.
- Add `GET /api/tags` — list the authenticated user's tags, each including its active-note count (soft-deleted notes excluded).
- Add `PUT /api/tags/:id` — rename/recolor the caller's own tag; rejects updates to another user's tag and name collisions.
- Add `DELETE /api/tags/:id` — delete the caller's own tag; removes its `NoteTag` associations but leaves associated notes untouched.
- Modify `POST /api/notes` and `PUT /api/notes/:id` to accept an optional `tagIds` array, validating that every supplied ID belongs to the authenticated user before associating it with the note.
- Modify the note response shape (used by create, read, update, and list) to include the note's associated `tags` (`id`, `name`, `color`).

## Capabilities

### New Capabilities

- `tag-management`: User-scoped tag CRUD (create, list with active-note counts, update, delete) per FR-TAG-001 through FR-TAG-004.

### Modified Capabilities

- `note-management`: Note create/update requests accept `tagIds`, and note responses include the associated `tags` array.

## Impact

- **Backend**: new `tagsRouter`/`tagService` (mounted at `/api/tags`), Prisma raw-SQL migration adding a case-insensitive functional index on `Tag(LOWER(name), userId)`, changes to `noteService`/`notesRouter` for `tagIds` handling and `tags` in responses.
- **Shared (`packages/shared`)**: new Zod schemas/DTOs for tag create/update/response, updates to the existing note request/response schemas to add `tagIds`/`tags`.
- **Database**: no schema changes beyond the functional index (the `Tag`/`NoteTag` tables already exist); tag-ownership validation is enforced at the service layer.
- **Rate limiting**: `/api/tags/*` falls under the existing global "Standard Authenticated API" limiter already configured in `app.ts` — no new limiter is added.
