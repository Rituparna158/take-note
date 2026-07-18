import { z } from "zod";

import { noteListMetaSchema, noteResponseSchema } from "../notes/schemas.js";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(10),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const noteSearchResultSchema = noteResponseSchema.extend({
  highlight: z.string(),
});
export type NoteSearchResult = z.infer<typeof noteSearchResultSchema>;

export const searchResponseSchema = z.object({
  data: z.array(noteSearchResultSchema),
  meta: noteListMetaSchema,
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
