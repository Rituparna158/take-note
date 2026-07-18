import { z } from "zod";

export const createTagRequestSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1),
});
export type CreateTagRequest = z.infer<typeof createTagRequestSchema>;

export const updateTagRequestSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1),
});
export type UpdateTagRequest = z.infer<typeof updateTagRequestSchema>;

export const tagResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
});
export type TagResponse = z.infer<typeof tagResponseSchema>;

export const tagWithCountResponseSchema = tagResponseSchema.extend({
  _count: z.object({
    notes: z.number().int().nonnegative(),
  }),
});
export type TagWithCountResponse = z.infer<typeof tagWithCountResponseSchema>;

export const tagListResponseSchema = z.array(tagWithCountResponseSchema);
export type TagListResponse = z.infer<typeof tagListResponseSchema>;
