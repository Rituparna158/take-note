import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { AppError, errorHandler, notFoundHandler } from "./errorHandler.js";

function createMockResponse() {
  const status = vi.fn();
  const json = vi.fn();
  const res = { status, json } as unknown as Response;
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  return { res, status, json };
}

describe("errorHandler", () => {
  it("maps an AppError with fields to the standard error shape", () => {
    const { res, status, json } = createMockResponse();
    const err = new AppError(400, "VALIDATION_ERROR", "Invalid input", { email: "required" });

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      fields: { email: "required" },
    });
  });

  it("maps an AppError without fields to the standard error shape", () => {
    const { res, status, json } = createMockResponse();
    const err = new AppError(404, "NOT_FOUND", "Route not found");

    errorHandler(err, {} as Request, res, {} as NextFunction);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ code: "NOT_FOUND", message: "Route not found" });
  });

  it("maps a generic Error to a 500 INTERNAL_SERVER_ERROR", () => {
    const { res, status, json } = createMockResponse();

    errorHandler(new Error("boom"), {} as Request, res, {} as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ code: "INTERNAL_SERVER_ERROR", message: "boom" });
  });

  it("maps a non-Error thrown value to a 500 with a generic message", () => {
    const { res, status, json } = createMockResponse();

    errorHandler("not an error", {} as Request, res, {} as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error",
    });
  });
});

describe("notFoundHandler", () => {
  it("forwards an AppError describing the unmatched route", () => {
    const next = vi.fn();
    const req = { method: "GET", originalUrl: "/api/does-not-exist" } as Request;

    notFoundHandler(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const forwarded = next.mock.calls[0]?.[0] as AppError;
    expect(forwarded).toBeInstanceOf(AppError);
    expect(forwarded.statusCode).toBe(404);
    expect(forwarded.code).toBe("NOT_FOUND");
    expect(forwarded.message).toBe("Route not found: GET /api/does-not-exist");
  });
});
