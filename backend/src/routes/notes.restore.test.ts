import { randomUUID } from "node:crypto";

import type { NoteListResponse, NoteResponse } from "@take-note/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { purgeExpiredNotes } from "../jobs/purgeNotes.js";
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
  return `notes-restore-test-${randomUUID()}@example.com`;
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
  title: "Restore Test Note",
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

describe("POST /api/notes/:id/restore", () => {
  it("restores a user's own soft-deleted note within the recovery window, returning it to the active list", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const restoreResponse = await request(app)
      .post(`/api/notes/${note.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(restoreResponse.status).toBe(200);
    expect((restoreResponse.body as { message: string }).message).toEqual(expect.any(String));

    const listResponse = await request(app)
      .get("/api/notes")
      .set("Authorization", `Bearer ${accessToken}`);

    const body = listResponse.body as NoteListResponse;
    expect(body.data.find((n) => n.id === note.id)).toBeDefined();
  });

  it("rejects a user restoring another user's soft-deleted note with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const response = await request(app)
      .post(`/api/notes/${note.id}/restore`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("rejects restoring a permanently purged note because it no longer exists", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });

    await purgeExpiredNotes();

    const response = await request(app)
      .post(`/api/notes/${note.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
