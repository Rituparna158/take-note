import { randomUUID } from "node:crypto";

import type { NoteResponse } from "@take-note/shared";
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
  return `tags-delete-test-${randomUUID()}@example.com`;
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

async function createNote(accessToken: string, title: string): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      title,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
      },
    });
  return response.body as NoteResponse;
}

async function createTagForUser(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { name, color: "#ff0000", userId } });
  return tag.id;
}

async function attachTagToNote(noteId: string, tagId: string): Promise<void> {
  await prisma.noteTag.create({ data: { noteId, tagId } });
}

describe("DELETE /api/tags/:id", () => {
  it("removes the caller's own tag", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");

    const response = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const stored = await prisma.tag.findUnique({ where: { id: tagId } });
    expect(stored).toBeNull();
  });

  it("removes the tag's note associations when it was associated with notes", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");
    const note = await createNote(accessToken, "Note A");
    await attachTagToNote(note.id, tagId);

    await request(app).delete(`/api/tags/${tagId}`).set("Authorization", `Bearer ${accessToken}`);

    const associations = await prisma.noteTag.findMany({ where: { tagId } });
    expect(associations).toHaveLength(0);
  });

  it("leaves the tag's associated notes available after deletion", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");
    const note = await createNote(accessToken, "Note A");
    await attachTagToNote(note.id, tagId);

    await request(app).delete(`/api/tags/${tagId}`).set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  it("rejects an attempt to delete another user's tag", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const attacker = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(owner.userId, "Work");

    const response = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${attacker.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("returns 404 NOT_FOUND when deleting a nonexistent tag", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .delete("/api/tags/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
