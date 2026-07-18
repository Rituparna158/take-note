import { randomUUID } from "node:crypto";

import type { NoteResponse, SearchResponse } from "@take-note/shared";
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
  return `search-list-test-${randomUUID()}@example.com`;
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

async function createNote(
  accessToken: string,
  title: string,
  bodyText: string,
  tagIds?: string[],
): Promise<NoteResponse> {
  const response = await request(app)
    .post("/api/notes")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      title,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: bodyText }] }],
      },
      ...(tagIds ? { tagIds } : {}),
    });
  return response.body as NoteResponse;
}

async function createTagForUser(accessToken: string, name: string): Promise<string> {
  const response = await request(app)
    .post("/api/tags")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name, color: "#ff0000" });
  return (response.body as { id: string }).id;
}

describe("GET /api/search - full-text note search", () => {
  it("returns the matching note when the search keyword matches a note title", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken, "Quarterly Roadmap", "Nothing relevant here.");
    await createNote(accessToken, "Grocery List", "Milk and eggs.");

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as SearchResponse).data.map((result) => result.id);
    expect(ids).toEqual([note.id]);
  });

  it("returns the matching note when the search keyword matches note content", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken, "Untitled", "Remember to water the succulents.");
    await createNote(accessToken, "Other Note", "Nothing relevant here.");

    const response = await request(app)
      .get("/api/search?q=succulents")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const ids = (response.body as SearchResponse).data.map((result) => result.id);
    expect(ids).toEqual([note.id]);
  });

  it("does not return a matching note that belongs to another user", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    await createNote(other.accessToken, "Owner Secret", "Confidential roadmap details.");

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as SearchResponse).data).toEqual([]);
  });

  it("does not return a matching note that is soft-deleted", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken, "Roadmap Draft", "Some roadmap content.");
    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as SearchResponse).data).toEqual([]);
  });

  it("returns search results across multiple pages when more notes match than the page limit", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Roadmap Alpha", "roadmap content one");
    await createNote(accessToken, "Roadmap Beta", "roadmap content two");
    await createNote(accessToken, "Roadmap Gamma", "roadmap content three");

    const response = await request(app)
      .get("/api/search?q=roadmap&limit=2")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as SearchResponse;
    expect(body.data).toHaveLength(2);
    expect(body.meta).toEqual({ totalCount: 3, page: 1, limit: 2, totalPages: 2 });
  });

  it("includes each matching note's associated tags in the search response", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const tagId = await createTagForUser(accessToken, "Work");
    await createNote(accessToken, "Roadmap Draft", "Some roadmap content.", [tagId]);

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as SearchResponse;
    expect(body.data[0]?.tags).toEqual([{ id: tagId, name: "Work", color: "#ff0000" }]);
  });
});
