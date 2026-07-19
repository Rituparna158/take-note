import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Request } from "express";

function skipInTestEnv(): boolean {
  return process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_TEST_MODE !== "1";
}

function ipAndTokenKeyGenerator(req: Request): string {
  const token = (req.params as { token?: string }).token ?? "unknown";
  return `${ipKeyGenerator(req.ip ?? "")}:${token}`;
}

export const publicShareViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
  keyGenerator: ipAndTokenKeyGenerator,
  message: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  },
});
