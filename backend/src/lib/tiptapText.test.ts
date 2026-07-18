import type { TiptapDocument } from "@take-note/shared";
import { describe, expect, it } from "vitest";

import { extractPlainText } from "./tiptapText.js";

describe("extractPlainText", () => {
  it("extracts text from a single paragraph", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
    };

    expect(extractPlainText(doc)).toBe("Hello world");
  });

  it("concatenates marked inline text runs within the same paragraph without inserting spaces", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello, " },
            { type: "text", text: "world", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "text", text: "!" },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("Hello, world!");
  });

  it("extracts text from nested block nodes (e.g. a list item inside a bullet list)", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "First item" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Second item" }] }],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("First item Second item");
  });

  it("returns an empty string for a document with no content nodes", () => {
    const doc: TiptapDocument = { type: "doc", content: [] };

    expect(extractPlainText(doc)).toBe("");
  });

  it("joins adjacent block nodes with a single space so words do not run together", () => {
    const doc: TiptapDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First paragraph" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
      ],
    };

    expect(extractPlainText(doc)).toBe("First paragraph Second paragraph");
  });
});
