import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import type { AuthSuccessBody, ErrorBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function extractRefreshCookie(setCookieHeader: string[] | undefined): string {
  const cookie = setCookieHeader?.find((entry) => entry.startsWith("refreshToken="));
  if (!cookie) {
    throw new Error("refreshToken cookie was not set");
  }
  return cookie.split(";")[0] as string;
}

async function registerAndGetTokens(email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  return {
    accessToken: (response.body as AuthSuccessBody).accessToken,
    refreshCookie: extractRefreshCookie(response.headers["set-cookie"] as string[] | undefined),
  };
}

describe("protected-route access token verification", () => {
  it("grants access to a protected route with a valid access token", async () => {
    const { accessToken } = await registerAndGetTokens("session-valid@example.com");

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  it("rejects a protected route request with a missing or invalid access token", async () => {
    const missingTokenResponse = await request(app).post("/api/auth/logout");
    expect(missingTokenResponse.status).toBe(401);
    expect((missingTokenResponse.body as ErrorBody).code).toBe("UNAUTHORIZED");

    const invalidTokenResponse = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(invalidTokenResponse.status).toBe(401);
    expect((invalidTokenResponse.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });
});

describe("POST /api/auth/refresh", () => {
  it("renews the session with a valid refresh token", async () => {
    const { refreshCookie } = await registerAndGetTokens("session-refresh@example.com");

    const response = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);

    expect(response.status).toBe(200);
    expect((response.body as AuthSuccessBody).accessToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
  });

  it("rejects an expired, missing, or invalid refresh token", async () => {
    const missingResponse = await request(app).post("/api/auth/refresh");
    expect(missingResponse.status).toBe(401);
    expect((missingResponse.body as ErrorBody).code).toBe("UNAUTHORIZED");

    const invalidResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refreshToken=not-a-real-token");
    expect(invalidResponse.status).toBe(401);
    expect((invalidResponse.body as ErrorBody).code).toBe("UNAUTHORIZED");

    const { accessToken, refreshCookie } = await registerAndGetTokens(
      "session-expired@example.com",
    );
    const claims = verifyAccessToken(accessToken);
    await prisma.refreshToken.updateMany({
      where: { userId: claims.sub },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(expiredResponse.status).toBe(401);
    expect((expiredResponse.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });
});
