import { describe, expect, it } from "vitest";

import {
  generateShareLinkRequestSchema,
  publicShareResponseSchema,
  shareLinkResponseSchema,
} from "./schemas.js";

const validDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello, world" }],
    },
  ],
};

describe("generateShareLinkRequestSchema", () => {
  it("accepts a request with expiresInDays omitted", () => {
    const result = generateShareLinkRequestSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresInDays).toBeUndefined();
    }
  });

  it("accepts an expiresInDays within the 1-30 range", () => {
    const result = generateShareLinkRequestSchema.safeParse({ expiresInDays: 14 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresInDays).toBe(14);
    }
  });

  it("rejects an expiresInDays of 0", () => {
    const result = generateShareLinkRequestSchema.safeParse({ expiresInDays: 0 });

    expect(result.success).toBe(false);
  });

  it("rejects an expiresInDays above 30", () => {
    const result = generateShareLinkRequestSchema.safeParse({ expiresInDays: 31 });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer expiresInDays", () => {
    const result = generateShareLinkRequestSchema.safeParse({ expiresInDays: 7.5 });

    expect(result.success).toBe(false);
  });
});

describe("shareLinkResponseSchema", () => {
  it("accepts a valid share-link response", () => {
    const result = shareLinkResponseSchema.safeParse({
      shareLink: "http://localhost:5173/share/plaintext-token-uuid",
      expiresAt: "2026-07-30T00:00:00.000Z",
      viewCount: 0,
      revoked: false,
    });

    expect(result.success).toBe(true);
  });
});

describe("publicShareResponseSchema", () => {
  it("accepts a valid public share response", () => {
    const result = publicShareResponseSchema.safeParse({
      title: "Public Note Title",
      content: validDoc,
      updatedAt: "2026-07-16T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});
