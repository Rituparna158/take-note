import { searchResponseSchema, type SearchResponse } from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";

export type SearchQueryParams = {
  q: string;
  page: number;
  limit: number;
};

export function buildSearchQueryString(params: SearchQueryParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  searchParams.set("page", String(params.page));
  searchParams.set("limit", String(params.limit));
  return searchParams.toString();
}

export async function getSearchResults(params: SearchQueryParams): Promise<SearchResponse> {
  const query = buildSearchQueryString(params);
  const response = await apiRequest<unknown>({
    method: "GET",
    path: `/api/search?${query}`,
  });
  return searchResponseSchema.parse(response);
}
