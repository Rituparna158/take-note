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
  return `share-status-test-${randomUUID()}@example.com`;
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
  title: "Share Status Test Note",
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

describe("GET /api/notes/:id/share", () => {
  it("returns the note owner's active share link status", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    const response = await request(app)
      .get(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as { viewCount: number; expiresAt: string; revoked: boolean };
    expect(body.viewCount).toBe(0);
    expect(body.revoked).toBe(false);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("reflects updated view counts after the public share link has been viewed", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const generateResponse = await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    const shareLink = (generateResponse.body as { shareLink: string }).shareLink;
    const token = shareLink.split("/share/")[1];

    await request(app).get(`/api/share/${token}`);

    const response = await request(app)
      .get(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as { viewCount: number }).viewCount).toBe(1);
  });

  it("returns 404 NOT_FOUND when the note has no active share link", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const response = await request(app)
      .get(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("returns 404 NOT_FOUND when the note's only share link has been revoked", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    await request(app)
      .delete(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("rejects a non-owner attempting to view the share status with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);
    await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({});

    const response = await request(app)
      .get(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });
});
