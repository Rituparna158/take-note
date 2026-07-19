import { randomUUID } from "node:crypto";

import type { NoteResponse, NoteVersionListItem, RestoreVersionResponse } from "@take-note/shared";
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
  return `versions-restore-test-${randomUUID()}@example.com`;
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
  title: "Restore Test Note",
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

async function listVersions(accessToken: string, noteId: string): Promise<NoteVersionListItem[]> {
  const response = await request(app)
    .get(`/api/notes/${noteId}/versions`)
    .set("Authorization", `Bearer ${accessToken}`);
  return response.body as NoteVersionListItem[];
}

describe("POST /api/notes/:id/versions/:versionId/restore", () => {
  it("applies the restored version's title/content and increments the version number", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedNotePayload);

    const versions = await listVersions(accessToken, note.id);
    const originalVersionId = versions[0]?.id as string;

    const response = await request(app)
      .post(`/api/notes/${note.id}/versions/${originalVersionId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const restored = response.body as RestoreVersionResponse;
    expect(restored.title).toBe(validNotePayload.title);
    expect(restored.content).toEqual(validNotePayload.content);
    expect(restored.version).toBe(3);

    const getResponse = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const current = getResponse.body as NoteResponse;
    expect(current.title).toBe(validNotePayload.title);
    expect(current.content).toEqual(validNotePayload.content);
  });

  it("preserves existing version history, including the version restored from, after a restore", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedNotePayload);

    const versionsBefore = await listVersions(accessToken, note.id);
    const originalVersionId = versionsBefore[0]?.id as string;

    await request(app)
      .post(`/api/notes/${note.id}/versions/${originalVersionId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    const versionsAfter = await listVersions(accessToken, note.id);
    expect(versionsAfter).toHaveLength(3);
    expect(versionsAfter.find((v) => v.id === originalVersionId)).toBeDefined();
  });

  it("permits restoring a version identical to the note's current live state, creating a new snapshot", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);

    const versions = await listVersions(accessToken, note.id);
    const currentVersionId = versions[0]?.id as string;

    const response = await request(app)
      .post(`/api/notes/${note.id}/versions/${currentVersionId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const restored = response.body as RestoreVersionResponse;
    expect(restored.version).toBe(2);

    const versionsAfter = await listVersions(accessToken, note.id);
    expect(versionsAfter).toHaveLength(2);
  });

  it("rejects a non-owner restoring another user's historical version with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);
    const versions = await listVersions(owner.accessToken, note.id);
    const versionId = versions[0]?.id as string;

    const response = await request(app)
      .post(`/api/notes/${note.id}/versions/${versionId}/restore`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("rejects restoring a version on a soft-deleted note with 404 NOT_FOUND", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const versions = await listVersions(accessToken, note.id);
    const versionId = versions[0]?.id as string;

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .post(`/api/notes/${note.id}/versions/${versionId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
