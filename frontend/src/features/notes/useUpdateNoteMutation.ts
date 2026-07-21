import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { NoteResponse, UpdateNoteRequest } from "@take-note/shared";

import { updateNote } from "./notesApi.js";

type UpdateNoteArgs = {
  id: string;
  payload: UpdateNoteRequest;
};

export function useUpdateNoteMutation(): UseMutationResult<NoteResponse, unknown, UpdateNoteArgs> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateNoteArgs) => updateNote(id, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["notes", variables.id] });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
