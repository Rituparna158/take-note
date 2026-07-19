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
  return `share-generate-test-${randomUUID()}@example.com`;
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
  title: "Share Generate Test Note",
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

describe("POST /api/notes/:id/share", () => {
  it("generates a public share link for the note owner's own note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const response = await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(201);
    const body = response.body as ShareLinkResponse;
    expect(body.shareLink).toContain("/share/");
    expect(body.viewCount).toBe(0);
    expect(body.revoked).toBe(false);
  });

  it("applies the default 7-day expiration when expiresInDays is not specified", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const response = await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(201);
    const body = response.body as ShareLinkResponse;
    const expiresAt = new Date(body.expiresAt).getTime();
    const expectedExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt - expectedExpiresAt)).toBeLessThan(60_000);
  });

  it("rejects an expiresInDays value outside the supported 1-30 range", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const response = await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ expiresInDays: 31 });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-owner attempting to generate a share link", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);

    const response = await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({});

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("rejects an unauthenticated request with 401 UNAUTHORIZED", async () => {
    const response = await request(app).post(`/api/notes/${randomUUID()}/share`).send({});

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).code).toBe("UNAUTHORIZED");
  });

  it("returns 404 NOT_FOUND when the note does not exist", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .post(`/api/notes/${randomUUID()}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
