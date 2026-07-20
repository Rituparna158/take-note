import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { NoteListResponse } from "@take-note/shared";

import { getNotes, type NotesQueryParams } from "./notesApi.js";

export function useNotesQuery(params: NotesQueryParams): UseQueryResult<NoteListResponse> {
  const normalizedTags = params.tags ? [...params.tags].sort() : undefined;

  return useQuery({
    queryKey: [
      "notes",
      {
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        tags: normalizedTags,
      },
    ],
    queryFn: () => getNotes(params),
    placeholderData: keepPreviousData,
  });
}
