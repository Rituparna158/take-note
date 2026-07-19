import { Router, type Request, type Response } from "express";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { AppError } from "../middleware/errorHandler.js";
import { getVersionOrThrow, listVersions, restoreVersion } from "../services/versionService.js";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
  }
  return req.user.id;
}

export const noteVersionsRouter: Router = Router({ mergeParams: true });

noteVersionsRouter.use(authenticateToken);

noteVersionsRouter.get("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const versions = await listVersions(userId, req.params.id as string);
  res.status(200).json(versions);
});

noteVersionsRouter.get("/:versionId", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const version = await getVersionOrThrow(
    userId,
    req.params.id as string,
    req.params.versionId as string,
  );
  res.status(200).json(version);
});

noteVersionsRouter.post("/:versionId/restore", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const result = await restoreVersion(
    userId,
    req.params.id as string,
    req.params.versionId as string,
  );
  res.status(200).json(result);
});
