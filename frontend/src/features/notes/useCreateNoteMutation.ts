import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { CreateNoteRequest, NoteResponse } from "@take-note/shared";

import { createNote } from "./notesApi.js";

export function useCreateNoteMutation(): UseMutationResult<
  NoteResponse,
  unknown,
  CreateNoteRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
