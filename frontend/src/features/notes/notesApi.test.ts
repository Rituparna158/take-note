import { describe, expect, it } from "vitest";

import { buildNotesQueryString } from "./notesApi.js";

describe("buildNotesQueryString", () => {
  it("encodes page, limit, sortBy, and sortOrder", () => {
    const query = buildNotesQueryString({
      page: 2,
      limit: 10,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    const params = new URLSearchParams(query);
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("10");
    expect(params.get("sortBy")).toBe("updatedAt");
    expect(params.get("sortOrder")).toBe("desc");
    expect(params.has("tags")).toBe(false);
  });

  it("joins multiple tag IDs with a comma", () => {
    const query = buildNotesQueryString({
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "asc",
      tags: ["tag-a", "tag-b"],
    });

    const params = new URLSearchParams(query);
    expect(params.get("tags")).toBe("tag-a,tag-b");
  });

  it("omits the tags parameter when the tags array is empty", () => {
    const query = buildNotesQueryString({
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "asc",
      tags: [],
    });

    const params = new URLSearchParams(query);
    expect(params.has("tags")).toBe(false);
  });
});
