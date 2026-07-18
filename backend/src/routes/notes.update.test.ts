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
  return `notes-update-test-${randomUUID()}@example.com`;
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
  title: "Update Test Note",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Original content" }],
      },
    ],
  },
};

const updatedNotePayload = {
  title: "Updated Title",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Updated content" }],
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

async function createTagForUser(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { name, color: "#ff0000", userId } });
  return tag.id;
}

describe("PUT /api/notes/:id", () => {
  it("saves changes to the title and content of a user's own active note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const updateResponse = await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedNotePayload);

    expect(updateResponse.status).toBe(200);
    expect((updateResponse.body as NoteResponse).title).toBe(updatedNotePayload.title);

    const getResponse = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const body = getResponse.body as NoteResponse;
    expect(body.title).toBe(updatedNotePayload.title);
    expect(body.content).toEqual(updatedNotePayload.content);
  });

  it("rejects a user updating another user's note with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);

    const response = await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send(updatedNotePayload);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("rejects updating a soft-deleted note with 404 NOT_FOUND", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const deleteResponse = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(200);

    const response = await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedNotePayload);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("replaces a note's tags with a new set of tags owned by the authenticated user", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const oldTagId = await createTagForUser(userId, "Old");
    const newTagId = await createTagForUser(userId, "New");
    await prisma.noteTag.create({ data: { noteId: note.id, tagId: oldTagId } });

    const response = await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...updatedNotePayload, tagIds: [newTagId] });

    expect(response.status).toBe(200);
    const body = response.body as NoteResponse;
    expect(body.tags).toEqual([{ id: newTagId, name: "New", color: "#ff0000" }]);
  });

  it("leaves existing tags untouched when tagIds is omitted from the update", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const tagId = await createTagForUser(userId, "Keep Me");
    await prisma.noteTag.create({ data: { noteId: note.id, tagId } });

    const response = await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedNotePayload);

    expect(response.status).toBe(200);
    const body = response.body as NoteResponse;
    expect(body.tags).toEqual([{ id: tagId, name: "Keep Me", color: "#ff0000" }]);
  });

  it("rejects a tag update when a tagIds entry is not owned by the user", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);
    const otherTagId = await createTagForUser(other.userId, "Not Mine");

    const response = await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ ...updatedNotePayload, tagIds: [otherTagId] });

    expect(response.status).toBe(422);
    expect((response.body as ErrorBody).code).toBe("CONFLICT");
  });
});
