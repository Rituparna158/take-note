import {
  shareLinkResponseSchema,
  type GenerateShareLinkRequest,
  type ShareLinkResponse,
} from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";

export async function generateShareLink(
  noteId: string,
  payload: GenerateShareLinkRequest,
): Promise<ShareLinkResponse> {
  const response = await apiRequest<unknown>({
    method: "POST",
    path: `/api/notes/${noteId}/share`,
    body: payload,
  });
  return shareLinkResponseSchema.parse(response);
}

export async function revokeShareLink(noteId: string): Promise<void> {
  await apiRequest<unknown>({
    method: "DELETE",
    path: `/api/notes/${noteId}/share`,
  });
}

export async function getShareLinkStatus(
  noteId: string,
): Promise<{ viewCount: number; expiresAt: string; revoked: boolean }> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: `/api/notes/${noteId}/share`,
  });
  return response as { viewCount: number; expiresAt: string; revoked: boolean };
}
