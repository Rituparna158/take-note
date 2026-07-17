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

async function registerUser(email: string, password: string) {
  await request(app).post("/api/auth/register").send({ email, password });
}

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    await registerUser("login-user@example.com", "password123");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "login-user@example.com", password: "password123" });

    const body = response.body as AuthSuccessBody;
    expect(response.status).toBe(200);
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.user.id).toBe("string");
    expect(body.user.email).toBe("login-user@example.com");
    expect(response.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
  });

  it("rejects an incorrect password", async () => {
    await registerUser("wrongpw@example.com", "password123");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrongpw@example.com", password: "incorrectPassword1" });

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });

  it("rejects an unregistered email address", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unregistered@example.com", password: "password123" });

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });
});
