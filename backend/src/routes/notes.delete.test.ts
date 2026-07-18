import { randomUUID } from "node:crypto";

import type { NoteListResponse, NoteResponse } from "@take-note/shared";
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
  return `notes-delete-test-${randomUUID()}@example.com`;
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

const validNotePayload = {
  title: "Delete Test Note",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Some content" }],
      },
    ],
  },
};

async function createNote(accessToken: string): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(validNotePayload);
  return response.body as NoteResponse;
}

describe("DELETE /api/notes/:id", () => {
  it("soft-deletes a user's own active note, marking it deleted rather than removing it", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const response = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as { message: string }).message).toEqual(expect.any(String));

    const dbRow = await prisma.note.findUnique({ where: { id: note.id } });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.deletedAt).not.toBeNull();
  });

  it("excludes a soft-deleted note from the active notes list", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const listResponse = await request(app)
      .get("/api/notes")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    const body = listResponse.body as NoteListResponse;
    expect(body.data.find((n) => n.id === note.id)).toBeUndefined();
  });

  it("retains the soft-deleted note's data during the 30-day recovery window", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const dbRow = await prisma.note.findUnique({ where: { id: note.id } });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.title).toBe(validNotePayload.title);
    expect(dbRow?.deletedAt).not.toBeNull();
  });

  it("rejects a user deleting another user's note with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);

    const response = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });
});
