import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Request } from "express";

function rateLimitExceededMessage(message: string) {
  return { code: "RATE_LIMIT_EXCEEDED", message };
}

function skipInTestEnv(): boolean {
  return process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_TEST_MODE !== "1";
}

function emailOrIpKeyGenerator(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email === "string" && email.trim().length > 0) {
    return email.trim().toLowerCase();
  }
  return ipKeyGenerator(req.ip ?? "");
}

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  message: rateLimitExceededMessage("Too many registration attempts. Please try again later."),
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  message: rateLimitExceededMessage("Too many login attempts. Please try again later."),
});

export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  message: rateLimitExceededMessage("Too many refresh attempts. Please try again later."),
});

export const logoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  message: rateLimitExceededMessage("Too many logout attempts. Please try again later."),
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  keyGenerator: emailOrIpKeyGenerator,
  message: rateLimitExceededMessage("Too many password reset requests. Please try again later."),
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  message: rateLimitExceededMessage("Too many password reset attempts. Please try again later."),
});
