import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "./errorHandler.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required shape for augmenting Express.Request
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

const BEARER_PREFIX = "Bearer ";

export function authenticateToken(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
  }

  const token = header.slice(BEARER_PREFIX.length);

  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, email: claims.email };
    next();
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token");
  }
}
