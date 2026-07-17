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

describe("POST /api/auth/register", () => {
  it("registers a new user and returns an access token, user, and refresh cookie", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "new-user@example.com", password: "password123" });

    const body = response.body as AuthSuccessBody;
    expect(response.status).toBe(201);
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.user.id).toBe("string");
    expect(body.user.email).toBe("new-user@example.com");
    expect(response.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
  });

  it("rejects an invalid email address", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a duplicate email address", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "password123" });

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "anotherPassword1" });

    expect(response.status).toBe(422);
    expect((response.body as ErrorBody).code).toBe("CONFLICT");
  });

  it("rejects a password below the minimum length", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "shortpw@example.com", password: "short1" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });
});
