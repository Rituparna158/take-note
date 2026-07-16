import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

describe("GET /api/health", () => {
  it("returns 200 with a status ok payload", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/unknown-route", () => {
  it("returns a 404 with the standard NOT_FOUND error shape", async () => {
    const app = createApp();
    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "NOT_FOUND",
      message: "Route not found: GET /api/unknown-route",
    });
  });
});

describe("notes_test database connectivity", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to notes_test and executes a trivial query", async () => {
    const result = await prisma.$queryRaw<{ result: number }[]>`SELECT 1 AS result`;

    expect(result[0]?.result).toBe(1);
  });
});
