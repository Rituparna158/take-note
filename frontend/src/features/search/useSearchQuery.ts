import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SearchResponse } from "@take-note/shared";

import { getSearchResults, type SearchQueryParams } from "./searchApi.js";

export function useSearchQuery(params: SearchQueryParams): UseQueryResult<SearchResponse> {
  const q = params.q.trim();

  return useQuery({
    queryKey: ["search", { q, page: params.page, limit: params.limit }],
    queryFn: () => getSearchResults({ ...params, q }),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });
}
