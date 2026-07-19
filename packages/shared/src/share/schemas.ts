import { z } from "zod";

import { tiptapDocumentSchema } from "../notes/schemas.js";

export const generateShareLinkRequestSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
});
export type GenerateShareLinkRequest = z.infer<typeof generateShareLinkRequestSchema>;

export const shareLinkResponseSchema = z.object({
  shareLink: z.string(),
  expiresAt: z.iso.datetime(),
  viewCount: z.number().int().nonnegative(),
  revoked: z.boolean(),
});
export type ShareLinkResponse = z.infer<typeof shareLinkResponseSchema>;

export const publicShareResponseSchema = z.object({
  title: z.string(),
  content: tiptapDocumentSchema,
  updatedAt: z.iso.datetime(),
});
export type PublicShareResponse = z.infer<typeof publicShareResponseSchema>;
