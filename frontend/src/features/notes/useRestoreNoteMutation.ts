import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { NoteResponse } from "@take-note/shared";

import { restoreNote } from "./notesApi.js";

export function useRestoreNoteMutation(): UseMutationResult<NoteResponse, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreNote(id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["notes", data.id] });
    },
  });
}
