import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { ErrorBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("/api/tags global rate limiting", () => {
  it("returns 429 RATE_LIMIT_EXCEEDED once the global standard-authenticated-API limiter threshold is exceeded", async () => {
    let lastResponse;
    for (let attempt = 0; attempt < 1001; attempt += 1) {
      lastResponse = await request(app).get("/api/tags");
    }

    expect(lastResponse?.status).toBe(429);
    expect((lastResponse?.body as ErrorBody | undefined)?.code).toBe("RATE_LIMIT_EXCEEDED");
  }, 60_000);
});
