import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TagListResponse } from "@take-note/shared";

import { getTags } from "./tagsApi.js";

export function useTagsQuery(): UseQueryResult<TagListResponse> {
  return useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
  });
}
