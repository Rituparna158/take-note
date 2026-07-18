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
  return `tags-update-test-${randomUUID()}@example.com`;
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

async function createTagForUser(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { name, color: "#ff0000", userId } });
  return tag.id;
}

describe("PUT /api/tags/:id", () => {
  it("saves changes to the caller's own tag", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");

    const response = await request(app)
      .put(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Personal", color: "#00ff00" });

    expect(response.status).toBe(200);
    const body = response.body as TagResponse;
    expect(body.name).toBe("Personal");
    expect(body.color).toBe("#00ff00");
  });

  it("rejects an attempt to update another user's tag", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const attacker = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(owner.userId, "Work");

    const response = await request(app)
      .put(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${attacker.accessToken}`)
      .send({ name: "Hijacked", color: "#000000" });

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("rejects an invalid tag payload with 400 VALIDATION_ERROR", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");

    const response = await request(app)
      .put(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "", color: "#00ff00" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 NOT_FOUND when updating a nonexistent tag", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .put("/api/tags/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Personal", color: "#00ff00" });

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
