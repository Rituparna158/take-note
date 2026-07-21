import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { deleteNote } from "./notesApi.js";

export function useDeleteNoteMutation(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
