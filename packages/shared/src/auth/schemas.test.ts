import { describe, expect, it } from "vitest";

import {
  authResponseSchema,
  authUserSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  messageResponseSchema,
  refreshResponseSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from "./schemas.js";

describe("registerRequestSchema", () => {
  it("accepts a valid email and an 8-character password", () => {
    const result = registerRequestSchema.safeParse({
      email: "user@example.com",
      password: "12345678",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email address", () => {
    const result = registerRequestSchema.safeParse({
      email: "not-an-email",
      password: "12345678",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerRequestSchema.safeParse({
      email: "user@example.com",
      password: "1234567",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginRequestSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "12345678",
    });

    expect(result.success).toBe(true);
  });
});

describe("authUserSchema", () => {
  it("accepts a valid uuid id and email", () => {
    const result = authUserSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "user@example.com",
    });

    expect(result.success).toBe(true);
  });
});

describe("authResponseSchema", () => {
  it("accepts a valid accessToken and user object", () => {
    const result = authResponseSchema.safeParse({
      accessToken: "some-jwt-token",
      user: { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" },
    });

    expect(result.success).toBe(true);
  });
});

describe("refreshResponseSchema", () => {
  it("accepts a valid accessToken", () => {
    const result = refreshResponseSchema.safeParse({ accessToken: "some-jwt-token" });

    expect(result.success).toBe(true);
  });

  it("rejects a missing accessToken", () => {
    const result = refreshResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordRequestSchema", () => {
  it("accepts a valid email", () => {
    const result = forgotPasswordRequestSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email address", () => {
    const result = forgotPasswordRequestSchema.safeParse({ email: "not-an-email" });

    expect(result.success).toBe(false);
  });
});

describe("resetPasswordRequestSchema", () => {
  it("accepts a valid email, 6-digit otp, and an 8-character new password", () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: "user@example.com",
      otp: "123456",
      newPassword: "12345678",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an otp that is not exactly 6 digits", () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: "user@example.com",
      otp: "12345",
      newPassword: "12345678",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a new password shorter than 8 characters", () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: "user@example.com",
      otp: "123456",
      newPassword: "1234567",
    });

    expect(result.success).toBe(false);
  });
});

describe("messageResponseSchema", () => {
  it("accepts a string message", () => {
    const result = messageResponseSchema.safeParse({ message: "Password reset successful" });

    expect(result.success).toBe(true);
  });
});
