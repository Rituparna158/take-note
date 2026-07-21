import {
  noteListResponseSchema,
  noteResponseSchema,
  type CreateNoteRequest,
  type ListNotesQuery,
  type NoteListResponse,
  type NoteResponse,
  type UpdateNoteRequest,
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

export async function getNote(id: string): Promise<NoteResponse> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: `/api/notes/${id}`,
  });
  return noteResponseSchema.parse(response);
}

export async function createNote(payload: CreateNoteRequest): Promise<NoteResponse> {
  const response = await apiRequest<unknown>({
    method: "POST",
    path: "/api/notes",
    body: payload,
  });
  return noteResponseSchema.parse(response);
}

export async function updateNote(id: string, payload: UpdateNoteRequest): Promise<NoteResponse> {
  const response = await apiRequest<unknown>({
    method: "PUT",
    path: `/api/notes/${id}`,
    body: payload,
  });
  return noteResponseSchema.parse(response);
}

export async function deleteNote(id: string): Promise<void> {
  await apiRequest<unknown>({
    method: "DELETE",
    path: `/api/notes/${id}`,
  });
}

export async function restoreNote(id: string): Promise<NoteResponse> {
  const response = await apiRequest<unknown>({
    method: "POST",
    path: `/api/notes/${id}/restore`,
  });
  return noteResponseSchema.parse(response);
}

export async function getTrashNotes(): Promise<NoteListResponse> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: "/api/notes/trash",
  });
  return noteListResponseSchema.parse(response);
}
