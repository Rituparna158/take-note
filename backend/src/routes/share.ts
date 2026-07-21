import { generateShareLinkRequestSchema } from "@take-note/shared";
import { Router, type Request, type Response } from "express";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { AppError } from "../middleware/errorHandler.js";
import { publicShareViewLimiter } from "../middleware/shareRateLimiters.js";
import {
  generateShareLink,
  getActiveShareLink,
  revokeShareLink,
  viewSharedNote,
} from "../services/shareService.js";

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

export const noteShareRouter: Router = Router({ mergeParams: true });

noteShareRouter.use(authenticateToken);

noteShareRouter.get("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await getActiveShareLink(userId, req.params.id as string);
  if (!result) {
    throw new AppError(404, "NOT_FOUND", "No active share link found for this note");
  }
  res.status(200).json(result);
});

noteShareRouter.post("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = generateShareLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid share link payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const result = await generateShareLink(userId, req.params.id as string, parsed.data);
  res.status(201).json(result);
});

noteShareRouter.delete("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  await revokeShareLink(userId, req.params.id as string);
  res.status(200).json({ message: "Share link revoked successfully" });
});

export const publicShareRouter: Router = Router();

publicShareRouter.get("/:token", publicShareViewLimiter, async (req: Request, res: Response) => {
  const result = await viewSharedNote(req.params.token as string);
  res.status(200).json(result);
});
