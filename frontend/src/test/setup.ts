import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./mocks/server.js";

// jsdom doesn't implement Range.getClientRects/getBoundingClientRect, which
// ProseMirror (TipTap's editor engine, AB-1012) calls when handling keystrokes.
Range.prototype.getClientRects = () =>
  ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as DOMRectList;
Range.prototype.getBoundingClientRect = () => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON() {},
});
document.elementFromPoint = () => null;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
