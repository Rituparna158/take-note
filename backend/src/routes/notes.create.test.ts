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
  return `notes-create-test-${randomUUID()}@example.com`;
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
  title: "My First Note",
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

async function createTagForUser(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { name, color: "#ff0000", userId } });
  return tag.id;
}

describe("POST /api/notes", () => {
  it("creates a note with valid title and rich-text content when authenticated", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validNotePayload);

    expect(response.status).toBe(201);
    const body = response.body as NoteResponse;
    expect(typeof body.id).toBe("string");
    expect(body.title).toBe(validNotePayload.title);
    expect(body.content).toEqual(validNotePayload.content);
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  it("associates the created note with its creator as owner", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const createResponse = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validNotePayload);

    const created = createResponse.body as NoteResponse;

    const getResponse = await request(app)
      .get(`/api/notes/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(getResponse.status).toBe(200);
    expect((getResponse.body as NoteResponse).id).toBe(created.id);
  });

  it("rejects note creation from an unauthenticated request", async () => {
    const response = await request(app).post("/api/notes").send(validNotePayload);

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });

  it("creates a note associated with tags owned by the authenticated user", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Work");

    const response = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validNotePayload, tagIds: [tagId] });

    expect(response.status).toBe(201);
    const body = response.body as NoteResponse;
    expect(body.tags).toEqual([{ id: tagId, name: "Work", color: "#ff0000" }]);
  });

  it("rejects note creation when a tagIds entry is not owned by the user", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const otherTagId = await createTagForUser(other.userId, "Not Mine");

    const response = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ ...validNotePayload, tagIds: [otherTagId] });

    expect(response.status).toBe(422);
    expect((response.body as ErrorBody).code).toBe("CONFLICT");
  });
});
