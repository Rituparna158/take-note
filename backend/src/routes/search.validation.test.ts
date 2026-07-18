import { randomUUID } from "node:crypto";

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

function uniqueEmail(): string {
  return `search-validation-test-${randomUUID()}@example.com`;
}

async function registerAndGetToken(email: string): Promise<{ accessToken: string }> {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  const body = response.body as AuthSuccessBody;
  return { accessToken: body.accessToken };
}

describe("GET /api/search - validation", () => {
  it("rejects a search request missing the q parameter", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a search request with a whitespace-only q parameter", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/search?q=%20%20%20")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an unauthenticated search request", async () => {
    const response = await request(app).get("/api/search?q=roadmap");

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });
});
