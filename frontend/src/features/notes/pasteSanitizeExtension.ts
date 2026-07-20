import { Extension } from "@tiptap/core";
import DOMPurify from "dompurify";

export const PasteSanitizeExtension = Extension.create({
  name: "pasteSanitize",

  transformPastedHTML(html: string): string {
    return DOMPurify.sanitize(html);
  },
});
