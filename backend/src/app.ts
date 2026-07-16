import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp(): Express {
  const app = express();

  // 1. Security headers
  app.use(helmet());

  // 2. CORS
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN,
      credentials: true,
    }),
  );

  // 3. Body parsing
  app.use(express.json());

  // 4. Cookie parsing (HTTP-only refresh token)
  app.use(cookieParser());

  // 5. Request logging
  app.use(pinoHttp());

  // 6. Rate limiting (standard authenticated-API baseline; per-endpoint limiters are
  // added alongside their routes starting with AB-1002)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // --- AB-1002+ inserts `authenticateToken` and the `/api/<domain>` routers here ---

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Catch-all for unmatched routes, then the global error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
