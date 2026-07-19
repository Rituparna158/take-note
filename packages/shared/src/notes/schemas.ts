import { z } from "zod";

import { tagResponseSchema } from "../tags/schemas.js";

export const tiptapMarkSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});
export type TiptapMark = z.infer<typeof tiptapMarkSchema>;

export const tiptapNodeSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  text: z.string().optional(),
  marks: z.array(tiptapMarkSchema).optional(),
  get content(): z.ZodOptional<z.ZodArray<typeof tiptapNodeSchema>> {
    return z.array(tiptapNodeSchema).optional();
  },
});
export type TiptapNode = z.infer<typeof tiptapNodeSchema>;

export const tiptapDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNodeSchema),
});
export type TiptapDocument = z.infer<typeof tiptapDocumentSchema>;

export const createNoteRequestSchema = z.object({
  title: z.string().trim().min(1),
  content: tiptapDocumentSchema,
  tagIds: z.array(z.uuid()).optional(),
});
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;

export const updateNoteRequestSchema = z.object({
  title: z.string().trim().min(1),
  content: tiptapDocumentSchema,
  tagIds: z.array(z.uuid()).optional(),
});
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>;

export const noteResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: tiptapDocumentSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  tags: z.array(tagResponseSchema),
});
export type NoteResponse = z.infer<typeof noteResponseSchema>;

export const noteListMetaSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type NoteListMeta = z.infer<typeof noteListMetaSchema>;

export const noteListResponseSchema = z.object({
  data: z.array(noteResponseSchema),
  meta: noteListMetaSchema,
});
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(10),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  tags: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value.split(",") : undefined))
    .pipe(z.array(z.uuid()).optional()),
});
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;

export const noteVersionListItemSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  savedAt: z.iso.datetime(),
});
export type NoteVersionListItem = z.infer<typeof noteVersionListItemSchema>;

export const noteVersionDetailSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  content: tiptapDocumentSchema,
  savedAt: z.iso.datetime(),
});
export type NoteVersionDetail = z.infer<typeof noteVersionDetailSchema>;

export const restoreVersionResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: tiptapDocumentSchema,
  version: z.number().int().positive(),
});
export type RestoreVersionResponse = z.infer<typeof restoreVersionResponseSchema>;
