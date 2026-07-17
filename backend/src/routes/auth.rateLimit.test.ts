import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { ErrorBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

beforeAll(() => {
  process.env.RATE_LIMIT_TEST_MODE = "1";
});

afterAll(() => {
  delete process.env.RATE_LIMIT_TEST_MODE;
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("login rate limiting", () => {
  it("returns 429 RATE_LIMIT_EXCEEDED once the login limiter threshold is exceeded", async () => {
    const credentials = { email: "rate-limit-test@example.com", password: "wrongPassword1" };

    let lastResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      lastResponse = await request(app).post("/api/auth/login").send(credentials);
    }

    expect(lastResponse?.status).toBe(429);
    expect((lastResponse?.body as ErrorBody | undefined)?.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
