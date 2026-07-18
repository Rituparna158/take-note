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
  return `notes-read-test-${randomUUID()}@example.com`;
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
  title: "Read Test Note",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello world" }],
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

describe("GET /api/notes/:id", () => {
  it("returns a user's own active note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const response = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteResponse;
    expect(body.id).toBe(note.id);
    expect(body.title).toBe(validNotePayload.title);
  });

  it("rejects a user reading another user's note with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);

    const response = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("returns 404 NOT_FOUND for a soft-deleted note via the standard read operation", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const deleteResponse = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(200);

    const response = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
