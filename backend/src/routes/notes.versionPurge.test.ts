import { randomUUID } from "node:crypto";

import type { NoteResponse, NoteVersionListItem } from "@take-note/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { purgeExpiredVersions } from "../jobs/purgeVersions.js";
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
  return `notes-version-purge-test-${randomUUID()}@example.com`;
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
  title: "Version Purge Test Note",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Some content" }] }],
  },
};

async function createNote(accessToken: string): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(validNotePayload);
  return response.body as NoteResponse;
}

const NINETY_ONE_DAYS_MS = 91 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe("purgeExpiredVersions()", () => {
  it("permanently purges a version snapshot older than 90 days, while leaving a recent one untouched", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    const expiredVersionId = versions[0]?.id as string;

    await prisma.noteVersion.update({
      where: { id: expiredVersionId },
      data: { savedAt: new Date(Date.now() - NINETY_ONE_DAYS_MS) },
    });

    const purgedCount = await purgeExpiredVersions();

    expect(purgedCount).toBeGreaterThanOrEqual(1);
    await expect(
      prisma.noteVersion.findUnique({ where: { id: expiredVersionId } }),
    ).resolves.toBeNull();
  });

  it("does not delete the current note even if all of its version snapshots are purged", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    await prisma.noteVersion.updateMany({
      where: { noteId: note.id },
      data: { savedAt: new Date(Date.now() - NINETY_ONE_DAYS_MS) },
    });

    await purgeExpiredVersions();

    await expect(prisma.note.findUnique({ where: { id: note.id } })).resolves.not.toBeNull();

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body as NoteVersionListItem[]).toHaveLength(0);
  });

  it("leaves a version saved less than 90 days ago untouched", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    const recentVersionId = versions[0]?.id as string;

    await prisma.noteVersion.update({
      where: { id: recentVersionId },
      data: { savedAt: new Date(Date.now() - THIRTY_DAYS_MS) },
    });

    await purgeExpiredVersions();

    await expect(
      prisma.noteVersion.findUnique({ where: { id: recentVersionId } }),
    ).resolves.not.toBeNull();
  });

  it("a purged version can no longer be viewed or restored", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id } });
    const versionId = versions[0]?.id as string;

    await prisma.noteVersion.update({
      where: { id: versionId },
      data: { savedAt: new Date(Date.now() - NINETY_ONE_DAYS_MS) },
    });

    await purgeExpiredVersions();

    const viewResponse = await request(app)
      .get(`/api/notes/${note.id}/versions/${versionId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(viewResponse.status).toBe(404);
    expect((viewResponse.body as ErrorBody).code).toBe("NOT_FOUND");

    const restoreResponse = await request(app)
      .post(`/api/notes/${note.id}/versions/${versionId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(restoreResponse.status).toBe(404);
    expect((restoreResponse.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
