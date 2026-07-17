import { rateLimit } from "express-rate-limit";

function rateLimitExceededMessage(message: string) {
  return { code: "RATE_LIMIT_EXCEEDED", message };
}

function skipInTestEnv(): boolean {
  return process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_TEST_MODE !== "1";
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
