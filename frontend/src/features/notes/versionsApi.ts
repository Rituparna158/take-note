import {
  noteVersionDetailSchema,
  noteVersionListItemSchema,
  restoreVersionResponseSchema,
  type NoteVersionDetail,
  type NoteVersionListItem,
  type RestoreVersionResponse,
} from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";

export async function getNoteVersions(noteId: string): Promise<NoteVersionListItem[]> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: `/api/notes/${noteId}/versions`,
  });
  return noteVersionListItemSchema.array().parse(response);
}

export async function getNoteVersion(
  noteId: string,
  versionId: string,
): Promise<NoteVersionDetail> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: `/api/notes/${noteId}/versions/${versionId}`,
  });
  return noteVersionDetailSchema.parse(response);
}

export async function restoreNoteVersion(
  noteId: string,
  versionId: string,
): Promise<RestoreVersionResponse> {
  const response = await apiRequest<unknown>({
    method: "POST",
    path: `/api/notes/${noteId}/versions/${versionId}/restore`,
  });
  return restoreVersionResponseSchema.parse(response);
}
