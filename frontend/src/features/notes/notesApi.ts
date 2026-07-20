import {
  noteListResponseSchema,
  type ListNotesQuery,
  type NoteListResponse,
} from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";

export type NotesQueryParams = Pick<ListNotesQuery, "page" | "limit" | "sortBy" | "sortOrder"> & {
  tags?: string[];
};

export function buildNotesQueryString(params: NotesQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("limit", String(params.limit));
  searchParams.set("sortBy", params.sortBy);
  searchParams.set("sortOrder", params.sortOrder);
  if (params.tags && params.tags.length > 0) {
    searchParams.set("tags", params.tags.join(","));
  }
  return searchParams.toString();
}

export async function getNotes(params: NotesQueryParams): Promise<NoteListResponse> {
  const query = buildNotesQueryString(params);
  const response = await apiRequest<unknown>({
    method: "GET",
    path: `/api/notes?${query}`,
  });
  return noteListResponseSchema.parse(response);
}
