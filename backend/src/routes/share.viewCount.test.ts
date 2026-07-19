import { randomUUID } from "node:crypto";

import type { NoteResponse, ShareLinkResponse } from "@take-note/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { AuthSuccessBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function uniqueEmail(): string {
  return `share-view-count-test-${randomUUID()}@example.com`;
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
  title: "Share View Count Test Note",
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

async function getViewCount(noteId: string): Promise<number> {
  const shareLink = await prisma.shareLink.findFirst({ where: { noteId } });
  return shareLink?.viewCount ?? 0;
}

describe("share link view counting", () => {
  it("increases the view count by one on a successful public view", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    await request(app).get(`/api/share/${token}`);

    expect(await getViewCount(note.id)).toBe(1);
  });

  it("reflects every successful concurrent view with no lost updates", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);

    const concurrentViews = 10;
    await Promise.all(
      Array.from({ length: concurrentViews }, () => request(app).get(`/api/share/${token}`)),
    );

    expect(await getViewCount(note.id)).toBe(concurrentViews);
  });

  it("does not increase the view count when an expired link is requested", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);
    await prisma.shareLink.updateMany({
      where: { noteId: note.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(403);
    expect(await getViewCount(note.id)).toBe(0);
  });

  it("does not increase the view count when a revoked link is requested", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const token = await createShareLink(accessToken, note.id);
    await request(app)
      .delete(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app).get(`/api/share/${token}`);

    expect(response.status).toBe(403);
    expect(await getViewCount(note.id)).toBe(0);
  });
});
