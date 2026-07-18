import { randomUUID } from "node:crypto";

import type { NoteResponse, TagListResponse } from "@take-note/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { AuthSuccessBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function uniqueEmail(): string {
  return `tags-list-test-${randomUUID()}@example.com`;
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

describe("GET /api/tags", () => {
  it("returns the authenticated user's own tags", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    await createTagForUser(owner.userId, "Work");
    await createTagForUser(other.userId, "Personal");

    const response = await request(app)
      .get("/api/tags")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as TagListResponse;
    expect(body).toHaveLength(1);
    expect(body[0]?.name).toBe("Work");
  });

  it("includes an accurate active-note count for a tag with active notes", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");
    const noteA = await createNote(accessToken, "Note A");
    const noteB = await createNote(accessToken, "Note B");
    await attachTagToNote(noteA.id, tagId);
    await attachTagToNote(noteB.id, tagId);

    const response = await request(app)
      .get("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as TagListResponse;
    expect(body[0]?._count.notes).toBe(2);
  });

  it("excludes soft-deleted notes from the active-note count", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");
    const note = await createNote(accessToken, "Note A");
    await attachTagToNote(note.id, tagId);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as TagListResponse;
    expect(body[0]?._count.notes).toBe(0);
  });
});
