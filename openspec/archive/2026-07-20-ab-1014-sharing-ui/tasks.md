## 1. Share API client and mutation hooks

- [x] 1.1 Create `frontend/src/features/notes/shareApi.ts` with `generateShareLink(noteId, payload)` (`POST /api/notes/:id/share`, response parsed with `shareLinkResponseSchema`) and `revokeShareLink(noteId)` (`DELETE /api/notes/:id/share`), using `apiRequest` from `frontend/src/lib/apiClient.ts` and types from `@take-note/shared` only. (Design §Decisions-1; SDS §3.5.1–3.5.2)
- [x] 1.2 Create `frontend/src/features/notes/useGenerateShareLinkMutation.ts` (TanStack `useMutation` wrapping `generateShareLink`, no `["notes"]` invalidation). (Design §Decisions-2)
- [x] 1.3 Create `frontend/src/features/notes/useRevokeShareLinkMutation.ts` (TanStack `useMutation` wrapping `revokeShareLink`, no `["notes"]` invalidation). (Design §Decisions-2)

## 2. ShareModal component

- [x] 2.1 Create `frontend/src/features/notes/ShareModal.tsx` with `{ noteId, open, onClose }` props, a `role="dialog"` / `aria-modal="true"` overlay, and a labelled close button; render nothing when `open` is false. (Design §Decisions-3; FR-UI-SHARE-001 "opens sharing controls" scenario)
- [x] 2.2 Add the expiration selector: a `<fieldset>` of radio inputs for 7 / 14 / 30 days plus "Use default (7 days)", following `TagPicker`'s accessible-input pattern; track selection in local state (`expiresInDays: number | undefined`). (Design §Decisions-3; FR-UI-SHARE-001 "configures supported expiration" scenario)
- [x] 2.3 Wire the "Generate link" button to `useGenerateShareLinkMutation`: on success store the returned `ShareLinkResponse` and set `revoked = false`; on error show an inline `role="alert"` message without clearing any previously displayed link. (Design §Decisions-3; FR-UI-SHARE-001 "generates a share link" and "generates a link without setting expiration" scenarios)
- [x] 2.4 Render the active-link status block (link URL, formatted `expiresAt`, `viewCount`) whenever `shareLink` is set and not revoked, including the "generating a new link replaces any previously shared link" note from the design's risk mitigation. (Design §Decisions-3, §Risks; FR-UI-SHARE-001 "generates a share link" scenario)
- [x] 2.5 Wire the "Revoke link" button to `useRevokeShareLinkMutation`: on success set `revoked = true` and swap the status block for a "Link revoked" message with the "Generate link" control re-enabled; on error show the same inline alert pattern without changing `revoked`. (Design §Decisions-3; FR-UI-SHARE-001 "revokes a share link" and "sharing operation fails" scenarios)

## 3. NoteEditorPage integration

- [x] 3.1 Add a `shareModalOpen` boolean state and a "Share" button in `NoteEditorPage`, rendered only when `noteId !== null` (an unsaved new note has no `:id` to target). (Design §Decisions-4)
- [x] 3.2 Render `<ShareModal noteId={noteId} open={shareModalOpen} onClose={() => setShareModalOpen(false)} />` conditionally in `NoteEditorPage`. (Design §Decisions-4)

## 4. Test fixtures

- [x] 4.1 Add success-path MSW handlers for `POST /api/notes/:id/share` and `DELETE /api/notes/:id/share` to `frontend/src/test/mocks/handlers.ts`, plus per-test `server.use(...)`-overridable failure variants for both. (Design §Decisions-5)

## 5. Automated component tests

- [x] 5.1 `frontend/src/features/notes/ShareModal.test.tsx` — "Note owner opens sharing controls": opening the modal displays the sharing interface. (FR-UI-SHARE-001 scenario)
- [x] 5.2 `ShareModal.test.tsx` — "Owner generates a share link": generating a link displays the returned public link. (FR-UI-SHARE-001 scenario)
- [x] 5.3 `ShareModal.test.tsx` — "Owner configures supported expiration": selecting a preset and generating applies that expiration preference in the displayed result. (FR-UI-SHARE-001 scenario)
- [x] 5.4 `ShareModal.test.tsx` — "Owner generates a link without setting expiration": generating without selecting a preset shows the server-applied default as applied. (FR-UI-SHARE-001 scenario)
- [x] 5.5 `ShareModal.test.tsx` — "Owner revokes a share link": revoking shows the link as no longer active. (FR-UI-SHARE-001 scenario)
- [x] 5.6 `ShareModal.test.tsx` — "Sharing operation fails": simulate a failing generate call and a failing revoke call (via the MSW failure-variant handlers from 4.1), asserting visible failure feedback in each case. (FR-UI-SHARE-001 scenario)
- [x] 5.7 `frontend/src/features/notes/NoteEditorPage.test.tsx` — add a test confirming the "Share" button opens `ShareModal` for a persisted note.

## 6. Quality gates and manual smoke test

- [x] 6.1 Run `pnpm --filter frontend build` — 0 errors, 0 warnings.
- [x] 6.2 Run `pnpm --filter frontend lint --max-warnings 0`.
- [x] 6.3 Run `pnpm --filter frontend test` — all tests pass; confirm new code meets the 80% coverage requirement (NFR-003).
- [x] 6.4 Manually smoke test in the browser (`pnpm --filter frontend dev`, backend + both Postgres containers running): open the share modal, generate a link with a preset expiration, generate one with the default, revoke a link, and trigger a failure path (e.g. offline/backend down) to confirm visible failure feedback.
