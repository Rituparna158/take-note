import { randomUUID } from "node:crypto";

import type { NoteResponse, NoteVersionDetail, NoteVersionListItem } from "@take-note/shared";
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
  return `versions-view-test-${randomUUID()}@example.com`;
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
  title: "Version View Test Note",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Original content" }] }],
  },
};

async function createNote(accessToken: string): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(validNotePayload);
  return response.body as NoteResponse;
}

async function firstVersionId(accessToken: string, noteId: string): Promise<string> {
  const response = await request(app)
    .get(`/api/notes/${noteId}/versions`)
    .set("Authorization", `Bearer ${accessToken}`);
  const versions = response.body as NoteVersionListItem[];
  const versionId = versions[0]?.id;
  if (!versionId) throw new Error("Expected at least one version");
  return versionId;
}

describe("GET /api/notes/:id/versions/:versionId", () => {
  it("returns the full content of a selected historical version", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const versionId = await firstVersionId(accessToken, note.id);

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions/${versionId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const version = response.body as NoteVersionDetail;
    expect(version.title).toBe(validNotePayload.title);
    expect(version.content).toEqual(validNotePayload.content);
  });

  it("does not modify the current note when viewing a historical version", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const versionId = await firstVersionId(accessToken, note.id);

    await request(app)
      .get(`/api/notes/${note.id}/versions/${versionId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const getResponse = await request(app)
      .get(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const current = getResponse.body as NoteResponse;
    expect(current.title).toBe(validNotePayload.title);
    expect(current.content).toEqual(validNotePayload.content);
  });

  it("rejects a non-owner viewing another user's historical version with 403 FORBIDDEN", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    const note = await createNote(owner.accessToken);
    const versionId = await firstVersionId(owner.accessToken, note.id);

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions/${versionId}`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).code).toBe("FORBIDDEN");
  });

  it("returns 404 NOT_FOUND for a version that has been purged", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const versionId = await firstVersionId(accessToken, note.id);

    await prisma.noteVersion.delete({ where: { id: versionId } });

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions/${versionId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("returns 404 NOT_FOUND for a missing note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get(`/api/notes/${randomUUID()}/versions/${randomUUID()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("returns 404 NOT_FOUND for a historical version of a soft-deleted note", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const versionId = await firstVersionId(accessToken, note.id);

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get(`/api/notes/${note.id}/versions/${versionId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).code).toBe("NOT_FOUND");
  });
});
