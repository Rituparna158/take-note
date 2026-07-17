import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
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

describe("POST /api/auth/logout", () => {
  it("ends the current session and clears the refresh cookie", async () => {
    const { accessToken, refreshCookie } = await registerAndGetTokens("logout-user@example.com");

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Logged out successfully" });
    expect(response.headers["set-cookie"]?.[0]).toMatch(/refreshToken=;/);
  });

  it("rejects reuse of the refresh token after logout", async () => {
    const { accessToken, refreshCookie } = await registerAndGetTokens("logout-reuse@example.com");

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(refreshResponse.status).toBe(401);
    expect((refreshResponse.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });

  it("succeeds even without a matching refresh token", async () => {
    const { accessToken } = await registerAndGetTokens("logout-no-cookie@example.com");

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Logged out successfully" });
  });
});
