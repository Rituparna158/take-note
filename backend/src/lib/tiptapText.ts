import type { TiptapDocument, TiptapNode } from "@take-note/shared";

function extractNodeText(node: TiptapNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (!node.content || node.content.length === 0) {
    return "";
  }

  const isInlineRun = node.content.every((child) => typeof child.text === "string");
  const separator = isInlineRun ? "" : " ";

  return node.content
    .map(extractNodeText)
    .filter((text) => text.length > 0)
    .join(separator);
}

export function extractPlainText(document: TiptapDocument): string {
  const text = document.content
    .map(extractNodeText)
    .filter((text) => text.length > 0)
    .join(" ");

  return text.replace(/\s+/g, " ").trim();
}
