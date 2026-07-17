import { describe, expect, it } from "vitest";

import { generateOtp, hashOtp } from "./otp.js";

describe("generateOtp", () => {
  it("always produces a 6-digit string", () => {
    for (let i = 0; i < 50; i += 1) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it("zero-pads values smaller than 100000", () => {
    let sawPadded = false;
    for (let i = 0; i < 200; i += 1) {
      const otp = generateOtp();
      if (otp.startsWith("0")) {
        sawPadded = true;
        break;
      }
    }
    expect(sawPadded).toBe(true);
  });
});

describe("hashOtp", () => {
  it("is deterministic for the same input", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"));
  });
});
