import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { CreateTagRequest, TagResponse } from "@take-note/shared";

import { createTag } from "./tagsApi.js";

export function useCreateTagMutation(): UseMutationResult<TagResponse, Error, CreateTagRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTagRequest) => createTag(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
