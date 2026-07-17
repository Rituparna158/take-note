import jsonwebtoken from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { signAccessToken, verifyAccessToken } from "./jwt.js";

const user = { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" };

describe("signAccessToken / verifyAccessToken", () => {
  it("verifies a signed token back to its claims", () => {
    const token = signAccessToken(user);
    const claims = verifyAccessToken(token);

    expect(claims).toEqual({ sub: user.id, email: user.email });
  });

  it("rejects an expired token", () => {
    const expiredToken = jsonwebtoken.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        algorithm: "HS256",
        expiresIn: "-10s",
      },
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow(jsonwebtoken.TokenExpiredError);
  });

  it("rejects a tampered/invalid token", () => {
    const token = signAccessToken(user);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(() => verifyAccessToken(tampered)).toThrow(jsonwebtoken.JsonWebTokenError);
  });
});
