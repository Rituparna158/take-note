import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { NoteResponse } from "@take-note/shared";

import { getNote } from "./notesApi.js";

export function useNoteQuery(id: string): UseQueryResult<NoteResponse> {
  return useQuery({
    queryKey: ["notes", id],
    queryFn: () => getNote(id),
    enabled: id.length > 0,
  });
}
