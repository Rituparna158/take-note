## Why

Note owners can already generate, revoke, and view public share links through the backend API (AB-1008), but there is no way to do this from the frontend. FR-UI-SHARE-001 requires a frontend sharing experience so an owner can manage a note's public link without leaving the note editor.

## What Changes

- Add a "Share" entry point inside `NoteEditorPage` that opens a share modal for the note currently being edited.
- Add a share modal that:
  - Lets the owner generate a public share link via `POST /api/notes/:id/share`, choosing an expiration from preset options (7 / 14 / 30 days) or accepting the server's 7-day default.
  - Displays the generated link's URL, expiration date, view count, and revoked state (from `ShareLinkResponse`).
  - Lets the owner revoke the active link via `DELETE /api/notes/:id/share`, after which the modal reflects the revoked state.
  - Shows visible success and failure feedback for both generate and revoke operations.
- Share state is session-only: since the SDS defines no `GET` endpoint for a note's current share status, the modal has no shared link to display until one is generated during the current page visit; it resets on reload or navigation.

## Capabilities

### New Capabilities

- `share-ui`: Frontend share modal covering opening sharing controls, generating a link with expiration selection (including default), displaying an active link and its status, revoking a link, and success/failure feedback — per FR-UI-SHARE-001.

### Modified Capabilities

- (none — this ticket only adds frontend behavior; no existing spec's requirements change)

## Impact

- **Frontend**: New share modal component and its trigger inside `frontend/src/features/notes/NoteEditorPage.tsx`; a new `sharesApi.ts` (or equivalent) client module calling `POST`/`DELETE /api/notes/:id/share`; no new Zustand store needed (modal open/link state is local component state, consistent with session-only scope).
- **Shared**: No new schemas required — `GenerateShareLinkRequest` and `ShareLinkResponse` already exist in `packages/shared/src/share/schemas.ts` and will be imported as-is.
- **Backend**: No changes. `POST /api/notes/:id/share` and `DELETE /api/notes/:id/share` already exist from AB-1008.
