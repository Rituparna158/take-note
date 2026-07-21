import {
  tagListResponseSchema,
  tagResponseSchema,
  type CreateTagRequest,
  type TagListResponse,
  type TagResponse,
} from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";

export async function getTags(): Promise<TagListResponse> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: "/api/tags",
  });
  return tagListResponseSchema.parse(response);
}

export async function createTag(payload: CreateTagRequest): Promise<TagResponse> {
  const response = await apiRequest<unknown>({
    method: "POST",
    path: "/api/tags",
    body: payload,
  });
  return tagResponseSchema.parse(response);
}
