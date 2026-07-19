import { randomUUID } from "node:crypto";

import type { NoteResponse, ShareLinkResponse } from "@take-note/shared";
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
  return `share-soft-delete-test-${randomUUID()}@example.com`;
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
  title: "Share Soft Delete Test Note",
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

function extractToken(shareLink: string): string {
  return shareLink.split("/").pop() as string;
}

async function createShareLink(accessToken: string, noteId: string): Promise<string> {
  const response = await request(app)
    .post(`/api/notes/${noteId}/share`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({});
  return extractToken((response.body as ShareLinkResponse).shareLink);
}

describe("sharing a soft-deleted note", () => {
  it("no longer exposes the note's content once an actively shared note is soft-deleted", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    const beforeDeleteResponse = await request(app).get(`/api/share/${token}`);
    expect(beforeDeleteResponse.status).toBe(200);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const afterDeleteResponse = await request(app).get(`/api/share/${token}`);

    expect(afterDeleteResponse.status).toBe(404);
    expect((afterDeleteResponse.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("does not return note content when a public visitor requests a shared soft-deleted note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("content");
  });
});
