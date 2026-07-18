import { randomUUID } from "node:crypto";

import type { NoteListResponse, NoteResponse } from "@take-note/shared";
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
  return `notes-list-test-${randomUUID()}@example.com`;
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

async function createNote(accessToken: string, title: string): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      title,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
      },
    });
  return response.body as NoteResponse;
}

async function setNoteTimestamps(noteId: string, createdAt: Date, updatedAt: Date): Promise<void> {
  await prisma.$executeRaw`UPDATE "Note" SET "createdAt" = ${createdAt}, "updatedAt" = ${updatedAt} WHERE id = ${noteId}`;
}

async function createTagForUser(userId: string, name: string): Promise<string> {
  const tag = await prisma.tag.create({ data: { name, color: "#ff0000", userId } });
  return tag.id;
}

async function attachTagToNote(noteId: string, tagId: string): Promise<void> {
  await prisma.noteTag.create({ data: { noteId, tagId } });
}

describe("GET /api/notes - pagination", () => {
  it("returns notes across multiple pages when there are more notes than the page limit", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Note 0");
    await createNote(accessToken, "Note 1");
    await createNote(accessToken, "Note 2");

    const response = await request(app)
      .get("/api/notes?limit=2")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toHaveLength(2);
    expect(body.meta).toEqual({ totalCount: 3, page: 1, limit: 2, totalPages: 2 });
  });

  it("returns the corresponding notes when requesting a specific page", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Note 0");
    await createNote(accessToken, "Note 1");
    await createNote(accessToken, "Note 2");

    const page1 = await request(app)
      .get("/api/notes?limit=2&page=1")
      .set("Authorization", `Bearer ${accessToken}`);
    const page2 = await request(app)
      .get("/api/notes?limit=2&page=2")
      .set("Authorization", `Bearer ${accessToken}`);

    const page1Body = page1.body as NoteListResponse;
    const page2Body = page2.body as NoteListResponse;
    expect(page1Body.data).toHaveLength(2);
    expect(page2Body.data).toHaveLength(1);
    expect(page2Body.meta).toEqual({ totalCount: 3, page: 2, limit: 2, totalPages: 2 });

    const page1Ids = page1Body.data.map((note) => note.id);
    const page2Ids = page2Body.data.map((note) => note.id);
    expect(page1Ids).not.toContain(page2Ids[0]);
  });

  it("excludes another user's notes from the list", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    await createNote(owner.accessToken, "Owner Note");
    await createNote(other.accessToken, "Other Note");

    const response = await request(app)
      .get("/api/notes")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.title).toBe("Owner Note");
  });
});

describe("GET /api/notes - sorting", () => {
  let accessToken: string;
  let noteXId: string;
  let noteYId: string;

  beforeEach(async () => {
    const auth = await registerAndGetToken(uniqueEmail());
    accessToken = auth.accessToken;

    const noteX = await createNote(accessToken, "Note X");
    const noteY = await createNote(accessToken, "Note Y");
    noteXId = noteX.id;
    noteYId = noteY.id;

    // noteX: created earlier, updated later. noteY: created later, updated earlier.
    // This cross-wiring proves sortBy actually selects the field it names.
    await setNoteTimestamps(
      noteXId,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-04T00:00:00.000Z"),
    );
    await setNoteTimestamps(
      noteYId,
      new Date("2026-01-02T00:00:00.000Z"),
      new Date("2026-01-03T00:00:00.000Z"),
    );
  });

  it("orders notes by creation time when sortBy=createdAt", async () => {
    const response = await request(app)
      .get("/api/notes?sortBy=createdAt")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as NoteListResponse).data.map((note) => note.id);
    expect(ids).toEqual([noteYId, noteXId]);
  });

  it("orders notes by last-updated time when sortBy=updatedAt", async () => {
    const response = await request(app)
      .get("/api/notes?sortBy=updatedAt")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as NoteListResponse).data.map((note) => note.id);
    expect(ids).toEqual([noteXId, noteYId]);
  });

  it("orders notes ascending when sortOrder=asc", async () => {
    const response = await request(app)
      .get("/api/notes?sortOrder=asc")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as NoteListResponse).data.map((note) => note.id);
    expect(ids).toEqual([noteYId, noteXId]);
  });

  it("orders notes descending when sortOrder=desc", async () => {
    const response = await request(app)
      .get("/api/notes?sortOrder=desc")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as NoteListResponse).data.map((note) => note.id);
    expect(ids).toEqual([noteXId, noteYId]);
  });
});

describe("GET /api/notes - tag filtering", () => {
  it("returns only notes matching an associated tag", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const noteWithTag = await createNote(accessToken, "Tagged Note");
    const noteWithoutTag = await createNote(accessToken, "Untagged Note");
    const tagId = await createTagForUser(userId, "Work");
    await attachTagToNote(noteWithTag.id, tagId);

    const response = await request(app)
      .get(`/api/notes?tags=${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as NoteListResponse).data.map((note) => note.id);
    expect(ids).toEqual([noteWithTag.id]);
    expect(ids).not.toContain(noteWithoutTag.id);
  });

  it("returns only notes matching all selected tags when filtering by multiple tags", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const noteBoth = await createNote(accessToken, "Both Tags");
    const noteOne = await createNote(accessToken, "One Tag");
    const tagA = await createTagForUser(userId, "Work");
    const tagB = await createTagForUser(userId, "Urgent");
    await attachTagToNote(noteBoth.id, tagA);
    await attachTagToNote(noteBoth.id, tagB);
    await attachTagToNote(noteOne.id, tagA);

    const response = await request(app)
      .get(`/api/notes?tags=${tagA},${tagB}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as NoteListResponse).data.map((note) => note.id);
    expect(ids).toEqual([noteBoth.id]);
  });

  it("returns an empty result set when no notes match the tag filter", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Untagged Note");
    const tagId = await createTagForUser(userId, "Unused");

    const response = await request(app)
      .get(`/api/notes?tags=${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toEqual([]);
    expect(body.meta.totalCount).toBe(0);
  });

  it("paginates filtered results across multiple pages", async () => {
    const { accessToken, userId } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(userId, "Shared");
    for (let i = 0; i < 3; i += 1) {
      const note = await createNote(accessToken, `Tagged ${i}`);
      await attachTagToNote(note.id, tagId);
    }

    const response = await request(app)
      .get(`/api/notes?tags=${tagId}&limit=2`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toHaveLength(2);
    expect(body.meta).toEqual({ totalCount: 3, page: 1, limit: 2, totalPages: 2 });
  });
});

describe("GET /api/notes - validation (technical tests)", () => {
  it("rejects a non-numeric page with a validation error", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/notes?page=abc")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a zero limit with a validation error", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/notes?limit=0")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an unsupported sortBy value with a validation error", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/notes?sortBy=title")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an unsupported sortOrder value with a validation error", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/notes?sortOrder=sideways")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a malformed (non-UUID) tag ID with a validation error", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());

    const response = await request(app)
      .get("/api/notes?tags=not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/notes - page overflow (technical test)", () => {
  it("returns an empty data array with accurate meta when page exceeds totalPages", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Only Note");

    const response = await request(app)
      .get("/api/notes?page=5&limit=10")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as NoteListResponse;
    expect(body.data).toEqual([]);
    expect(body.meta).toEqual({ totalCount: 1, page: 5, limit: 10, totalPages: 1 });
  });
});
