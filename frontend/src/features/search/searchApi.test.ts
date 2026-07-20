import { describe, expect, it } from "vitest";

import { buildSearchQueryString } from "./searchApi.js";

describe("buildSearchQueryString", () => {
  it("encodes q, page, and limit", () => {
    const query = buildSearchQueryString({ q: "meeting notes", page: 2, limit: 10 });

    const params = new URLSearchParams(query);
    expect(params.get("q")).toBe("meeting notes");
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("10");
  });

  it("encodes the default page and limit values", () => {
    const query = buildSearchQueryString({ q: "keyword", page: 1, limit: 10 });

    const params = new URLSearchParams(query);
    expect(params.get("page")).toBe("1");
    expect(params.get("limit")).toBe("10");
  });
});
