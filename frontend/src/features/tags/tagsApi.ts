import { tagListResponseSchema, type TagListResponse } from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";

export async function getTags(): Promise<TagListResponse> {
  const response = await apiRequest<unknown>({
    method: "GET",
    path: "/api/tags",
  });
  return tagListResponseSchema.parse(response);
}
