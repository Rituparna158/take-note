import { randomUUID } from "node:crypto";

import type { NoteResponse } from "@take-note/shared";
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
  return `notes-purge-test-${randomUUID()}@example.com`;
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
  title: "Purge Test Note",
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

const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

describe("purgeExpiredNotes()", () => {
  it("permanently purges a note soft-deleted for more than 30 days, while leaving a note soft-deleted less than 30 days ago untouched", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const expiredNote = await createNote(accessToken);
    const recentNote = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${expiredNote.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    await request(app)
      .delete(`/api/notes/${recentNote.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    await prisma.note.update({
      where: { id: expiredNote.id },
      data: { deletedAt: new Date(Date.now() - THIRTY_ONE_DAYS_MS) },
    });
    await prisma.note.update({
      where: { id: recentNote.id },
      data: { deletedAt: new Date(Date.now() - FIVE_DAYS_MS) },
    });

    const purgedCount = await purgeExpiredNotes();

    expect(purgedCount).toBeGreaterThanOrEqual(1);
    await expect(prisma.note.findUnique({ where: { id: expiredNote.id } })).resolves.toBeNull();
    await expect(prisma.note.findUnique({ where: { id: recentNote.id } })).resolves.not.toBeNull();
  });

  it("fails to restore a note that has been permanently purged", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date(Date.now() - THIRTY_ONE_DAYS_MS) },
    });

    await purgeExpiredNotes();

    const response = await request(app)
      .post(`/api/notes/${note.id}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("cascade-deletes a purged note's share link so it no longer grants public access", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const shareLink = await prisma.shareLink.create({
      data: {
        noteId: note.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        viewCount: 0,
        revoked: false,
      },
    });

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date(Date.now() - THIRTY_ONE_DAYS_MS) },
    });

    await purgeExpiredNotes();

    await expect(prisma.shareLink.findUnique({ where: { id: shareLink.id } })).resolves.toBeNull();
  });
});
