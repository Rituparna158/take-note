import { loginRequestSchema, registerRequestSchema } from "@take-note/shared";
import { Router, type Request, type Response } from "express";

import { authenticateToken } from "../middleware/authenticateToken.js";
import {
  loginLimiter,
  logoutLimiter,
  refreshLimiter,
  registerLimiter,
} from "../middleware/authRateLimiters.js";
import { AppError } from "../middleware/errorHandler.js";
import { loginUser, logoutUser, refreshSession, registerUser } from "../services/authService.js";
import type { AuthResult } from "../services/authService.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

function setRefreshCookie(res: Response, refreshToken: AuthResult["refreshToken"]): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken.token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
}

function getRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined>).refreshToken;
}

export const authRouter: Router = Router();

authRouter.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parsed = registerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid registration payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const result = await registerUser(parsed.data.email, parsed.data.password);
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ accessToken: result.accessToken, user: result.user });
});

authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid login payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const result = await loginUser(parsed.data.email, parsed.data.password);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
});

authRouter.post("/refresh", refreshLimiter, async (req: Request, res: Response) => {
  const refreshToken = getRefreshCookie(req);
  if (!refreshToken) {
    throw new AppError(401, "UNAUTHORIZED", "Missing refresh token");
  }

  const result = await refreshSession(refreshToken);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken });
});

authRouter.post(
  "/logout",
  logoutLimiter,
  authenticateToken,
  async (req: Request, res: Response) => {
    await logoutUser(getRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(200).json({ message: "Logged out successfully" });
  },
);
