## Context

FR-UI-SHARE-001 (FRS §13) requires a frontend sharing experience for note owners. The backend endpoints already exist from AB-1008: `POST /api/notes/:id/share` (generate, revokes any prior link on the note) and `DELETE /api/notes/:id/share` (revoke), both defined in SDS §3.5.1–3.5.2 and typed by `packages/shared/src/share/schemas.ts` (`GenerateShareLinkRequest`, `ShareLinkResponse`). There is no `GET` status endpoint for a note's current share link (confirmed against SDS §3.5) — per the approved proposal, the frontend treats share state as session-only.

The only current entry point for note-level actions is `NoteEditorPage` (`frontend/src/features/notes/NoteEditorPage.tsx`), which already renders `TagPicker` inline next to the title/editor. There is no existing modal/dialog component anywhere in `frontend/src` — this ticket introduces the app's first one.

## Goals / Non-Goals

**Goals:**

- Let a note owner open a share modal from `NoteEditorPage`, generate a share link (with an optional preset expiration), see its status (link, expiration, view count, revoked), and revoke it — per FR-UI-SHARE-001's acceptance criteria.
- Reuse existing patterns: TanStack Query mutations for server calls, `apiRequest`/`ApiError` from `frontend/src/lib/apiClient.ts` for the HTTP layer, Zod-parsed responses via the shared schemas, Tailwind for styling, MSW handlers for tests.
- Keep the modal's link/expiration/view-count/revoked state as local component state scoped to the modal's lifetime (no Zustand store, no persisted cache) — consistent with the session-only decision in the proposal.

**Non-Goals:**

- No backend changes (no new endpoints, no schema changes). SDS API contracts are fixed for this ticket.
- No persistence of share state across page reloads or navigation away from the note — this is an accepted proposal decision, not a bug to design around.
- No general-purpose/reusable `Modal` primitive beyond what this feature needs; build the minimal dialog required for `share-ui` (a reusable primitive can be extracted later if a second consumer appears — not needed now).
- No changes to `NoteListItem` or the notes list page (entry point is editor-only per the approved proposal).

## Decisions

**1. New `frontend/src/features/notes/shareApi.ts`** mirroring `notesApi.ts`'s shape:

- `generateShareLink(noteId: string, payload: GenerateShareLinkRequest): Promise<ShareLinkResponse>` → `apiRequest({ method: "POST", path: `/api/notes/${noteId}/share`, body: payload })`, response parsed with `shareLinkResponseSchema.parse(...)`.
- `revokeShareLink(noteId: string): Promise<void>` → `apiRequest({ method: "DELETE", path: `/api/notes/${noteId}/share` })`. The backend returns `{ message }`; the frontend does not need to parse or use it, since the modal derives "no longer active" from local state after a successful call.
- Both types (`GenerateShareLinkRequest`, `ShareLinkResponse`) are imported from `@take-note/shared` — no local redeclaration, per shared-package rules.

**2. Two new TanStack Query mutation hooks**, alongside `useCreateNoteMutation.ts`/`useUpdateNoteMutation.ts`:

- `useGenerateShareLinkMutation(noteId: string)` wrapping `generateShareLink`.
- `useRevokeShareLinkMutation(noteId: string)` wrapping `revokeShareLink`.
- Neither invalidates the `["notes"]` query key — share state isn't part of the `Note` DTO returned by `GET /api/notes`/`GET /api/notes/:id`, so there's nothing server-cached to invalidate. This matches the session-only decision: the modal's own local state is the only source of truth for share status.

**3. New `ShareModal` component** (`frontend/src/features/notes/ShareModal.tsx`):

- Props: `noteId: string`, `open: boolean`, `onClose: () => void`.
- Local state: `expiresInDays: number | undefined` (selected preset, `undefined` = default), `shareLink: ShareLinkResponse | null`, `revoked: boolean`.
- Renders a `role="dialog"` `aria-modal="true"` overlay (plain Tailwind-styled `<div>`s — no external dialog dependency, since AGENTS.md prohibits introducing new libraries without an approved reason and none is needed for a straightforward modal).
- Expiration control: a `<fieldset>` of radio inputs for `7`/`14`/`30` days plus a "Use default (7 days)" option, following the same accessible-labelled-input pattern already used in `TagPicker`.
- "Generate link" button calls `useGenerateShareLinkMutation`; on success stores the `ShareLinkResponse` and sets `revoked = false`; on error shows an inline `role="alert"` message (mirrors the failure-feedback pattern already used in `NoteEditorPage` for creation/load failures) and leaves any previously displayed link/state untouched.
- When `shareLink` is set and not revoked: displays the link URL, formatted `expiresAt`, `viewCount`, and a "Revoke link" button; when revoked, replaces that block with a "Link revoked" status message and re-enables "Generate link" for a fresh link.
- "Revoke link" button calls `useRevokeShareLinkMutation`; on success sets `revoked = true`; on error shows the same inline alert pattern without changing `revoked`.
- Closing the modal (`onClose`) does not clear `shareLink`/`revoked` by itself — state naturally resets when `NoteEditorPage` unmounts the modal or the page reloads, satisfying the session-only requirement without extra logic.

**4. `NoteEditorPage` integration**:

- Add a `shareModalOpen` boolean (`useState`) and a "Share" button next to the title/`TagPicker` area, rendered only once the note has an id (`noteId !== null`) — sharing an unsaved/new note has no `:id` to target.
- Render `<ShareModal noteId={noteId} open={shareModalOpen} onClose={() => setShareModalOpen(false)} />` conditionally on `open`.

**5. Testing approach**:

- Component tests in `frontend/src/features/notes/ShareModal.test.tsx`, following the existing MSW pattern: add `POST /api/notes/:id/share` and `DELETE /api/notes/:id/share` handlers to `frontend/src/test/mocks/handlers.ts` (success and failure variants, e.g. via a per-test `server.use(...)` override for failure cases, matching how other pages test error paths).
- One test per FRS acceptance-criteria scenario for FR-UI-SHARE-001 (§13): open → interface displayed; generate → link displayed; select expiration → preference applied; generate without expiration → default shown as applied; revoke → shown as no longer active; operation fails → visible failure feedback. Named to match the delta spec's scenario titles for traceability.
- `NoteEditorPage.test.tsx` gets one additional test confirming the "Share" button opens `ShareModal` for a persisted note.

## Risks / Trade-offs

- **[Risk]** Session-only share status may surprise an owner who reopens the modal after navigating away and sees no link, even though one is still active server-side. → **Mitigation**: this is an explicit, approved proposal trade-off (no backend GET endpoint exists in the fixed SDS contract); the modal's copy will state "Generating a new link replaces any previously shared link" so the owner isn't misled into thinking no link is currently active.
- **[Risk]** Building a bespoke dialog instead of using an accessible-dialog library risks missing focus-trap/`Escape`-to-close behavior. → **Mitigation**: scope this ticket's dialog to the minimum accessible pattern (`role="dialog"`, `aria-modal`, a labelled close button, closing on backdrop click); no keyboard focus-trap library is justified for a single-consumer modal, consistent with AGENTS.md's fixed-technology-stack constraint.
- **[Trade-off]** Not invalidating `["notes"]` after generate/revoke means the notes list/editor never reflects "this note has an active share" anywhere outside the modal. Acceptable because FR-UI-SHARE-001 only requires the sharing _interface_ itself to reflect link state, not other views.

## Migration Plan

Purely additive frontend feature; no data migration, no feature flag. Ships behind the existing `feature/frontend/AB-1014-sharing-ui` branch through the normal quality-gate → review → archive → PR flow. No rollback concerns beyond reverting the merge commit if needed.

## Open Questions

None — the approved proposal already resolved the two ambiguous points (entry-point scope, session-only share state).
