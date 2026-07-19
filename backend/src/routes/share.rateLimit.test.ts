import { randomUUID } from "node:crypto";

import type { NoteResponse, ShareLinkResponse } from "@take-note/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { AuthSuccessBody, ErrorBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

beforeAll(() => {
  process.env.RATE_LIMIT_TEST_MODE = "1";
});

afterAll(() => {
  delete process.env.RATE_LIMIT_TEST_MODE;
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function uniqueEmail(): string {
  return `share-rate-limit-test-${randomUUID()}@example.com`;
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
  title: "Share Rate Limit Test Note",
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

describe("public share link rate limiting", () => {
  it("returns 429 RATE_LIMIT_EXCEEDED once the public share view limiter threshold is exceeded", async () => {
    const { accessToken } = await registerAndGetToken(uniqueEmail());
    const note = await createNote(accessToken);
    const shareResponse = await request(app)
      .post(`/api/notes/${note.id}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    const token = extractToken((shareResponse.body as ShareLinkResponse).shareLink);

    let lastResponse;
    for (let attempt = 0; attempt < 61; attempt += 1) {
      lastResponse = await request(app).get(`/api/share/${token}`);
    }

    expect(lastResponse?.status).toBe(429);
    expect((lastResponse?.body as ErrorBody | undefined)?.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
