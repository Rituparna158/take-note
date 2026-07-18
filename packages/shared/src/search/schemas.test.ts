import { describe, expect, it } from "vitest";

import { noteSearchResultSchema, searchQuerySchema, searchResponseSchema } from "./schemas.js";

const validDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello, world" }],
    },
  ],
};

describe("searchQuerySchema", () => {
  it("accepts a valid q with defaults applied for page and limit", () => {
    const result = searchQuerySchema.safeParse({ q: "keyword" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ q: "keyword", page: 1, limit: 10 });
    }
  });

  it("trims a q value with surrounding whitespace", () => {
    const result = searchQuerySchema.safeParse({ q: "  keyword  " });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("keyword");
    }
  });

  it("accepts valid page and limit overrides", () => {
    const result = searchQuerySchema.safeParse({ q: "keyword", page: "2", limit: "20" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(20);
    }
  });

  it("rejects a missing q", () => {
    const result = searchQuerySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects an empty q", () => {
    const result = searchQuerySchema.safeParse({ q: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only q", () => {
    const result = searchQuerySchema.safeParse({ q: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects a zero page", () => {
    const result = searchQuerySchema.safeParse({ q: "keyword", page: "0" });

    expect(result.success).toBe(false);
  });

  it("rejects a negative limit", () => {
    const result = searchQuerySchema.safeParse({ q: "keyword", limit: "-1" });

    expect(result.success).toBe(false);
  });
});

describe("noteSearchResultSchema", () => {
  it("accepts a valid note search result with highlight and tags", () => {
    const result = noteSearchResultSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "My Note",
      content: validDoc,
      createdAt: "2026-07-16T12:00:00.000Z",
      updatedAt: "2026-07-16T12:00:00.000Z",
      tags: [{ id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", name: "Work", color: "#ff0000" }],
      highlight: "Hello, <mark>world</mark>",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a note search result missing highlight", () => {
    const result = noteSearchResultSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "My Note",
      content: validDoc,
      createdAt: "2026-07-16T12:00:00.000Z",
      updatedAt: "2026-07-16T12:00:00.000Z",
      tags: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("searchResponseSchema", () => {
  it("accepts a data/meta envelope with zero results", () => {
    const result = searchResponseSchema.safeParse({
      data: [],
      meta: { totalCount: 0, page: 1, limit: 10, totalPages: 0 },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a data/meta envelope with results", () => {
    const result = searchResponseSchema.safeParse({
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: "My Note",
          content: validDoc,
          createdAt: "2026-07-16T12:00:00.000Z",
          updatedAt: "2026-07-16T12:00:00.000Z",
          tags: [],
          highlight: "Hello, <mark>world</mark>",
        },
      ],
      meta: { totalCount: 1, page: 1, limit: 10, totalPages: 1 },
    });

    expect(result.success).toBe(true);
  });
});
