## Why

Note version snapshots have existed on the backend since AB-1009 (`GET/POST /api/notes/:id/versions*`), but there is no frontend surface for a note owner to see, preview, or restore a historical version. FR-UI-VER-001 and FR-UI-VER-002 require a version-history drawer and restore experience in the note editor so this existing backend capability is actually usable.

## What Changes

- Add a "History" entry point to the note editor toolbar (next to the existing "Share" button in `NoteEditorPage.tsx`), shown only once the note exists (`noteId !== null`).
- Add a version-history drawer that, on open, fetches and lists the note's historical versions (version number + saved date) via `GET /api/notes/:id/versions`.
- Support selecting a version in the drawer to preview its title and rendered rich-text content read-only, inline within the drawer, via `GET /api/notes/:id/versions/:versionId`, without mutating the live editor's state.
- Support restoring a selected version via `POST /api/notes/:id/versions/:versionId/restore`; on success, update the editor's displayed title/content to the restored state (discarding any unsaved live edits) and close the drawer.
- Show visible failure feedback in the drawer if listing, previewing, or restoring fails, without representing a failed restore as successful.

## Capabilities

### New Capabilities

- `version-history-ui`: Frontend version-history drawer in the note editor — listing historical versions, read-only preview of a selected version, and restore-to-current-note with visible success/failure feedback.

### Modified Capabilities

(none — this only adds a new frontend capability; no existing spec's requirements change)

## Impact

- **Affected code**: `frontend/src/features/notes/` (new `VersionHistoryDrawer.tsx`, a `useNoteVersionsQuery`/`useNoteVersionQuery` pair, and a `useRestoreVersionMutation`; `NoteEditorPage.tsx` gains the "History" entry point and wiring to apply restored content/title into editor state, mirroring the existing `ShareModal` integration pattern).
- **Shared types**: none needed — `NoteVersionListItem`, `NoteVersionDetail`, and `RestoreVersionResponse` already exist in `packages/shared` (added during AB-1009) and will be reused as-is.
- **APIs**: no backend or contract changes; consumes the existing `/api/notes/:id/versions` endpoints exactly as specified in SDS §3.6.
- **Dependencies**: none new.
