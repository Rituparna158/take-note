import type { NextFunction, Request, Response } from "express";

export interface ErrorResponseBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(statusCode: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      code: err.code,
      message: err.message,
      ...(err.fields ? { fields: err.fields } : {}),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  const body: ErrorResponseBody = { code: "INTERNAL_SERVER_ERROR", message };
  res.status(500).json(body);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`));
}
