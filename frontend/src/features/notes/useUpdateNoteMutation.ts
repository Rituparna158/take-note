import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { NoteResponse, UpdateNoteRequest } from "@take-note/shared";

import { updateNote } from "./notesApi.js";

export function useUpdateNoteMutation(
  id: string,
): UseMutationResult<NoteResponse, unknown, UpdateNoteRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateNoteRequest) => updateNote(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
