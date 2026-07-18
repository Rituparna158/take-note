import { createTagRequestSchema, updateTagRequestSchema } from "@take-note/shared";
import { Router, type Request, type Response } from "express";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { AppError } from "../middleware/errorHandler.js";
import { createTag, deleteTag, listTagsWithCounts, updateTag } from "../services/tagService.js";

function zodIssuesToFields(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    fields[key] = issue.message;
  }
  return fields;
}

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
  }
  return req.user.id;
}

export const tagsRouter: Router = Router();

tagsRouter.use(authenticateToken);

tagsRouter.post("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = createTagRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid tag payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const tag = await createTag(userId, parsed.data);
  res.status(201).json(tag);
});

tagsRouter.get("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const tags = await listTagsWithCounts(userId);
  res.status(200).json(tags);
});

tagsRouter.put("/:id", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = updateTagRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid tag payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const tag = await updateTag(userId, req.params.id as string, parsed.data);
  res.status(200).json(tag);
});

tagsRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  await deleteTag(userId, req.params.id as string);
  res.status(200).json({ message: "Tag deleted successfully" });
});
