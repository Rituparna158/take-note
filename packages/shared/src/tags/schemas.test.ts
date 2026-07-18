import { describe, expect, it } from "vitest";

import {
  createTagRequestSchema,
  tagListResponseSchema,
  tagResponseSchema,
  tagWithCountResponseSchema,
  updateTagRequestSchema,
} from "./schemas.js";

describe("createTagRequestSchema", () => {
  it("accepts a valid name and color", () => {
    const result = createTagRequestSchema.safeParse({ name: "Work", color: "#ff0000" });

    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createTagRequestSchema.safeParse({ name: "", color: "#ff0000" });

    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    const result = createTagRequestSchema.safeParse({ name: "   ", color: "#ff0000" });

    expect(result.success).toBe(false);
  });

  it("trims a name with surrounding whitespace", () => {
    const result = createTagRequestSchema.safeParse({ name: "  Work  ", color: "#ff0000" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Work");
    }
  });

  it("rejects an empty color", () => {
    const result = createTagRequestSchema.safeParse({ name: "Work", color: "" });

    expect(result.success).toBe(false);
  });

  it("accepts a non-hex color string (no format constraint)", () => {
    const result = createTagRequestSchema.safeParse({ name: "Work", color: "red" });

    expect(result.success).toBe(true);
  });
});

describe("updateTagRequestSchema", () => {
  it("accepts a valid name and color", () => {
    const result = updateTagRequestSchema.safeParse({ name: "Personal", color: "#00ff00" });

    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = updateTagRequestSchema.safeParse({ name: "", color: "#00ff00" });

    expect(result.success).toBe(false);
  });
});

describe("tagResponseSchema", () => {
  it("accepts a valid tag response object", () => {
    const result = tagResponseSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Work",
      color: "#ff0000",
    });

    expect(result.success).toBe(true);
  });
});

describe("tagWithCountResponseSchema", () => {
  it("accepts a tag with an active-note count", () => {
    const result = tagWithCountResponseSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Work",
      color: "#ff0000",
      _count: { notes: 5 },
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative note count", () => {
    const result = tagWithCountResponseSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Work",
      color: "#ff0000",
      _count: { notes: -1 },
    });

    expect(result.success).toBe(false);
  });
});

describe("tagListResponseSchema", () => {
  it("accepts an empty list", () => {
    const result = tagListResponseSchema.safeParse([]);

    expect(result.success).toBe(true);
  });

  it("accepts a list of tags with counts", () => {
    const result = tagListResponseSchema.safeParse([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Work",
        color: "#ff0000",
        _count: { notes: 2 },
      },
    ]);

    expect(result.success).toBe(true);
  });
});
