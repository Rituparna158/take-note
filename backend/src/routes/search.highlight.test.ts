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
  return `search-highlight-test-${randomUUID()}@example.com`;
}

async function registerAndGetToken(email: string): Promise<{ accessToken: string }> {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  const body = response.body as AuthSuccessBody;
  return { accessToken: body.accessToken };
}

async function createNote(
  accessToken: string,
  title: string,
  bodyText: string,
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
    });
  return response.body as NoteResponse;
}

describe("GET /api/search - result highlighting", () => {
  it("includes highlighted match information when a keyword matches searchable note text", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Meeting Notes", "We discussed the quarterly roadmap in detail.");

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const result = (response.body as SearchResponse).data[0];
    expect(result?.highlight).toBeTruthy();
  });

  it("visually distinguishes the matching keyword with <mark> tags in the results", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    await createNote(accessToken, "Meeting Notes", "We discussed the quarterly roadmap in detail.");

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const result = (response.body as SearchResponse).data[0];
    expect(result?.highlight).toContain("<mark>roadmap</mark>");
  });

  it("exposes no match information from another user's note containing the keyword", async () => {
    const owner = await registerAndGetToken(uniqueEmail());
    const other = await registerAndGetToken(uniqueEmail());
    await createNote(other.accessToken, "Other Roadmap", "Confidential roadmap plans.");

    const response = await request(app)
      .get("/api/search?q=roadmap")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as SearchResponse).data).toEqual([]);
  });
});
