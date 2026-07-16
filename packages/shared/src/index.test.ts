import { describe, expect, it } from "vitest";
import { SHARED_PACKAGE_NAME } from "./index.js";

describe("packages/shared barrel module", () => {
  it("loads without error and exports the package name", () => {
    expect(SHARED_PACKAGE_NAME).toBe("@take-note/shared");
  });
});
