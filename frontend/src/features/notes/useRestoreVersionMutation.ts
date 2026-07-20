import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { RestoreVersionResponse } from "@take-note/shared";

import { restoreNoteVersion } from "./versionsApi.js";

export function useRestoreVersionMutation(
  noteId: string,
): UseMutationResult<RestoreVersionResponse, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) => restoreNoteVersion(noteId, versionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes", noteId] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["notes", noteId, "versions"] }),
      ]);
    },
  });
}
