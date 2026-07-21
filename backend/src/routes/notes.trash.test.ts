import { randomUUID } from "node:crypto";

import type { NoteListResponse, NoteResponse } from "@take-note/shared";
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
  return `notes-trash-test-${randomUUID()}@example.com`;
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

describe("GET /api/notes/trash", () => {
  it("returns the user's soft-deleted notes", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken, "Trashed Note");
    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get("/api/notes/trash")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data.find((n) => n.id === note.id)).toBeDefined();
    expect(body.meta.totalCount).toBe(1);
  });

  it("excludes active (non-deleted) notes", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Still Active Note");

    const response = await request(app)
      .get("/api/notes/trash")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toHaveLength(0);
    expect(body.meta.totalCount).toBe(0);
  });

  it("excludes another user's soft-deleted notes", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const ownerNote = await createNote(owner.accessToken, "Owner's Trashed Note");
    await request(app)
      .delete(`/api/notes/${ownerNote.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const response = await request(app)
      .get("/api/notes/trash")
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toHaveLength(0);
  });
});
