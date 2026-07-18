import { describe, expect, it } from "vitest";

import {
  createNoteRequestSchema,
  listNotesQuerySchema,
  noteListResponseSchema,
  noteResponseSchema,
  tiptapDocumentSchema,
  updateNoteRequestSchema,
} from "./schemas.js";

const validDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello, " },
        { type: "text", text: "world", marks: [{ type: "bold" }] },
      ],
    },
  ],
};

describe("tiptapDocumentSchema", () => {
  it("accepts a valid nested TipTap document", () => {
    const result = tiptapDocumentSchema.safeParse(validDoc);

    expect(result.success).toBe(true);
  });

  it("accepts a document with no content nodes", () => {
    const result = tiptapDocumentSchema.safeParse({ type: "doc", content: [] });

    expect(result.success).toBe(true);
  });

  it("rejects a document missing the doc type literal", () => {
    const result = tiptapDocumentSchema.safeParse({ type: "paragraph", content: [] });

    expect(result.success).toBe(false);
  });

  it("rejects a document with a malformed node (missing type)", () => {
    const result = tiptapDocumentSchema.safeParse({
      type: "doc",
      content: [{ content: [{ type: "text", text: "no type" }] }],
    });

    expect(result.success).toBe(false);
  });
});

describe("createNoteRequestSchema", () => {
  it("accepts a valid title and TipTap document", () => {
    const result = createNoteRequestSchema.safeParse({ title: "My Note", content: validDoc });

    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = createNoteRequestSchema.safeParse({ title: "", content: validDoc });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const result = createNoteRequestSchema.safeParse({ title: "   ", content: validDoc });

    expect(result.success).toBe(false);
  });

  it("trims a title with surrounding whitespace", () => {
    const result = createNoteRequestSchema.safeParse({ title: "  My Note  ", content: validDoc });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("My Note");
    }
  });
});

describe("updateNoteRequestSchema", () => {
  it("accepts a valid title and TipTap document", () => {
    const result = updateNoteRequestSchema.safeParse({ title: "Updated", content: validDoc });

    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = updateNoteRequestSchema.safeParse({ title: "", content: validDoc });

    expect(result.success).toBe(false);
  });
});

describe("noteResponseSchema", () => {
  it("accepts a valid note response object", () => {
    const result = noteResponseSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "My Note",
      content: validDoc,
      createdAt: "2026-07-16T12:00:00.000Z",
      updatedAt: "2026-07-16T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});

describe("noteListResponseSchema", () => {
  it("accepts a data/meta envelope with zero results", () => {
    const result = noteListResponseSchema.safeParse({
      data: [],
      meta: { totalCount: 0, page: 1, limit: 0, totalPages: 1 },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a data/meta envelope with results", () => {
    const result = noteListResponseSchema.safeParse({
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: "My Note",
          content: validDoc,
          createdAt: "2026-07-16T12:00:00.000Z",
          updatedAt: "2026-07-16T12:00:00.000Z",
        },
      ],
      meta: { totalCount: 1, page: 1, limit: 1, totalPages: 1 },
    });

    expect(result.success).toBe(true);
  });
});

describe("listNotesQuerySchema", () => {
  it("applies defaults when params are omitted", () => {
    const result = listNotesQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 1, limit: 10, sortBy: "updatedAt", sortOrder: "desc" });
    }
  });

  it("accepts valid page, limit, sortBy, sortOrder, and tags", () => {
    const result = listNotesQuerySchema.safeParse({
      page: "2",
      limit: "20",
      sortBy: "createdAt",
      sortOrder: "asc",
      tags: "550e8400-e29b-41d4-a716-446655440000,6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("asc");
      expect(result.data.tags).toEqual([
        "550e8400-e29b-41d4-a716-446655440000",
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      ]);
    }
  });

  it("accepts a large limit with no upper bound", () => {
    const result = listNotesQuerySchema.safeParse({ limit: "10000" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10000);
    }
  });

  it("rejects a non-numeric page", () => {
    const result = listNotesQuerySchema.safeParse({ page: "abc" });

    expect(result.success).toBe(false);
  });

  it("rejects a zero page", () => {
    const result = listNotesQuerySchema.safeParse({ page: "0" });

    expect(result.success).toBe(false);
  });

  it("rejects a negative limit", () => {
    const result = listNotesQuerySchema.safeParse({ limit: "-1" });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported sortBy value", () => {
    const result = listNotesQuerySchema.safeParse({ sortBy: "title" });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported sortOrder value", () => {
    const result = listNotesQuerySchema.safeParse({ sortOrder: "sideways" });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed (non-UUID) tag ID", () => {
    const result = listNotesQuerySchema.safeParse({ tags: "not-a-uuid" });

    expect(result.success).toBe(false);
  });

  it("treats an empty tags string as no filter", () => {
    const result = listNotesQuerySchema.safeParse({ tags: "" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toBeUndefined();
    }
  });
});
