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
  return `share-public-view-test-${randomUUID()}@example.com`;
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
  title: "Share Public View Test Note",
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

describe("GET /api/share/:token", () => {
  it("allows a public visitor to view a valid share link without authentication", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(200);
    const body = response.body as { title: string; content: unknown; updatedAt: string };
    expect(body.title).toBe(validNotePayload.title);
    expect(body.content).toEqual(validNotePayload.content);
  });

  it("does not expose any route to modify the note through a share link", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    const putResponse = await request(app).put(`/api/share/${token}`).send({ title: "Hacked" });
    const deleteResponse = await request(app).delete(`/api/share/${token}`);

    expect(putResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it("allows access to a share link before its expiration time", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(200);
  });

  it("rejects access to an expired share link with 403 FORBIDDEN", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    await prisma.shareLink.updateMany({
      where: { noteId: note.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("rejects access to a revoked share link with 403 FORBIDDEN", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    await request(app)
      .delete(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("returns 404 NOT_FOUND for an unknown token", async () => {
    const response = await request(app).get(`/api/share/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
