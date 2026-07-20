import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import type { GenerateShareLinkRequest, ShareLinkResponse } from "@take-note/shared";

import { generateShareLink } from "./shareApi.js";

export function useGenerateShareLinkMutation(
  noteId: string,
): UseMutationResult<ShareLinkResponse, unknown, GenerateShareLinkRequest> {
  return useMutation({
    mutationFn: (payload: GenerateShareLinkRequest) => generateShareLink(noteId, payload),
  });
}
