import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { revokeShareLink } from "./shareApi.js";

export function useRevokeShareLinkMutation(noteId: string): UseMutationResult<void, unknown, void> {
  return useMutation({
    mutationFn: () => revokeShareLink(noteId),
  });
}
