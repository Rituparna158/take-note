import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { NoteVersionDetail } from "@take-note/shared";

import { getNoteVersion } from "./versionsApi.js";

export function useNoteVersionQuery(
  noteId: string,
  versionId: string | null,
): UseQueryResult<NoteVersionDetail> {
  return useQuery({
    queryKey: ["notes", noteId, "versions", versionId],
    queryFn: () => getNoteVersion(noteId, versionId as string),
    enabled: versionId !== null,
  });
}
