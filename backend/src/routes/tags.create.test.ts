import { randomUUID } from "node:crypto";

import type { TagResponse } from "@take-note/shared";
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
  return `tags-create-test-${randomUUID()}@example.com`;
}

async function registerAndGetToken(
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  const body = response.body as AuthSuccessBody;
  return { accessToken: body.accessToken, userId: body.user.id };
}

describe("POST /api/tags", () => {
  it("creates a tag with a valid name and color when authenticated", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Work", color: "#ff0000" });

    expect(response.status).toBe(201);
    const body = response.body as TagResponse;
    expect(typeof body.id).toBe("string");
    expect(body.name).toBe("Work");
    expect(body.color).toBe("#ff0000");
  });

  it("associates the created tag with its creator", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Work", color: "#ff0000" });

    const created = response.body as TagResponse;
    const stored = await prisma.tag.findUnique({ where: { id: created.id } });
    expect(stored?.userId).toBe(userId);
  });

  it("keeps another user's tag scope independent when names collide", async () => {
    const userA = await registerAndGetToken(uniqueEmail());
    const userB = await registerAndGetToken(uniqueEmail());

    await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ name: "Work", color: "#ff0000" });

    const response = await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ name: "Work", color: "#00ff00" });

    expect(response.status).toBe(201);
  });

  it("rejects a duplicate tag name within the same user's scope (case-insensitive)", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Work", color: "#ff0000" });

    const response = await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "WORK", color: "#00ff00" });

    expect(response.status).toBe(422);
    expect((response.body as ErrorBody).code).toBe("CONFLICT");
  });

  it("rejects an invalid tag payload with 400 VALIDATION_ERROR", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "", color: "#ff0000" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });
});
