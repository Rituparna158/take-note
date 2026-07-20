import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { NoteVersionListItem } from "@take-note/shared";

import { getNoteVersions } from "./versionsApi.js";

export function useNoteVersionsQuery(
  noteId: string,
  options: { enabled: boolean },
): UseQueryResult<NoteVersionListItem[]> {
  return useQuery({
    queryKey: ["notes", noteId, "versions"],
    queryFn: () => getNoteVersions(noteId),
    enabled: options.enabled,
  });
}
