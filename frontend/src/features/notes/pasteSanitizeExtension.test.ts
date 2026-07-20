import { describe, expect, it } from "vitest";

import { PasteSanitizeExtension } from "./pasteSanitizeExtension.js";

describe("PasteSanitizeExtension", () => {
  it("Pasted HTML content is sanitized before insertion", () => {
    const config = PasteSanitizeExtension.config as unknown as {
      transformPastedHTML: (html: string) => string;
    };
    expect(typeof config.transformPastedHTML).toBe("function");

    const sanitized = config.transformPastedHTML(
      '<p>safe <img src="x" onerror="alert(1)">text</p><script>alert(2)</script>',
    );

    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).toContain("safe");
    expect(sanitized).toContain("text");
  });
});
