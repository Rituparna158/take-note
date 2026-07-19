import { randomUUID } from "node:crypto";

import type { NoteResponse, NoteVersionListItem } from "@take-note/shared";
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
  return `versions-list-test-${randomUUID()}@example.com`;
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
  title: "Version List Test Note",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Original content" }] }],
  },
};

const updatedNotePayload = {
  title: "Updated Title",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Updated content" }] }],
  },
};

async function createNote(accessToken: string): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(validNotePayload);
  return response.body as NoteResponse;
}

describe("GET /api/notes/:id/versions", () => {
  it("returns the note owner's versions ordered oldest-to-newest", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedNotePayload);

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const versions = response.body as NoteVersionListItem[];
    expect(versions).toHaveLength(2);
    expect(versions[0]?.version).toBe(1);
    expect(versions[0]?.title).toBe(validNotePayload.title);
    expect(versions[1]?.version).toBe(2);
    expect(versions[1]?.title).toBe(updatedNotePayload.title);
  });

  it("rejects a non-owner requesting another user's note version history with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("returns 404 NOT_FOUND for a missing note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get(`/api/notes/${randomUUID()}/versions`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("returns 404 NOT_FOUND for a soft-deleted note's version history", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
