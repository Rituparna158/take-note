import jsonwebtoken from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { signAccessToken } from "../lib/jwt.js";
import { authenticateToken } from "./authenticateToken.js";
import { AppError } from "./errorHandler.js";

const user = { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" };

function createRequest(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request;
}

describe("authenticateToken", () => {
  it("attaches user claims and calls next for a valid token", () => {
    const token = signAccessToken(user);
    const req = createRequest(`Bearer ${token}`);
    const next = vi.fn() as NextFunction;

    authenticateToken(req, {} as Response, next);

    expect(req.user).toEqual({ id: user.id, email: user.email });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws UNAUTHORIZED when the authorization header is missing", () => {
    const req = createRequest(undefined);

    expect(() => authenticateToken(req, {} as Response, vi.fn())).toThrow(AppError);
    try {
      authenticateToken(req, {} as Response, vi.fn());
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).code).toBe("UNAUTHORIZED");
    }
  });

  it("throws UNAUTHORIZED when the authorization header is malformed", () => {
    const req = createRequest("NotBearer sometoken");

    expect(() => authenticateToken(req, {} as Response, vi.fn())).toThrow(AppError);
  });

  it("throws UNAUTHORIZED for an invalid signature", () => {
    const req = createRequest(`Bearer ${signAccessToken(user)}tampered`);

    expect(() => authenticateToken(req, {} as Response, vi.fn())).toThrow(AppError);
  });

  it("throws UNAUTHORIZED for an expired token", () => {
    const expired = jsonwebtoken.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        algorithm: "HS256",
        expiresIn: "-10s",
      },
    );
    const req = createRequest(`Bearer ${expired}`);

    expect(() => authenticateToken(req, {} as Response, vi.fn())).toThrow(AppError);
  });
});
