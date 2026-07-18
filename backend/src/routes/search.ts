import { searchQuerySchema } from "@take-note/shared";
import { Router, type Request, type Response } from "express";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { AppError } from "../middleware/errorHandler.js";
import { searchNotes } from "../services/searchService.js";

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

export const searchRouter: Router = Router();

searchRouter.use(authenticateToken);

searchRouter.get("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid search query",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const result = await searchNotes(userId, parsed.data);
  res.status(200).json(result);
});
