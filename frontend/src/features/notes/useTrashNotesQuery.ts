import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { NoteListResponse } from "@take-note/shared";

import { getTrashNotes } from "./notesApi.js";

export function useTrashNotesQuery(): UseQueryResult<NoteListResponse> {
  return useQuery({
    queryKey: ["notes", "trash"],
    queryFn: () => getTrashNotes(),
  });
}
