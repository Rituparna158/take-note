import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { AuthSuccessBody, ErrorBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

async function registerTestUser(email: string): Promise<void> {
  await request(app).post("/api/auth/register").send({ email, password: "password123" });
}

async function requestOtp(email: string): Promise<string> {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  await request(app).post("/api/auth/forgot-password").send({ email });
  const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
  logSpy.mockRestore();

  const match = /(\d{6})/.exec(logged);
  const otp = match?.[1];
  if (!otp) {
    throw new Error("Expected an OTP to be logged to the console");
  }
  return otp;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/reset-password", () => {
  it("resets the password with a valid unexpired OTP", async () => {
    const email = "reset-success@example.com";
    await registerTestUser(email);
    const otp = await requestOtp(email);

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "newPassword123" });

    expect(response.status).toBe(200);
  });

  it("rejects an invalid OTP", async () => {
    const email = "reset-invalid@example.com";
    await registerTestUser(email);
    await requestOtp(email);

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp: "000000", newPassword: "newPassword123" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an expired OTP", async () => {
    const email = "reset-expired@example.com";
    await registerTestUser(email);
    const otp = await requestOtp(email);

    await prisma.user.update({
      where: { email },
      data: { resetOtpExpires: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "newPassword123" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a reused OTP", async () => {
    const email = "reset-reuse@example.com";
    await registerTestUser(email);
    const otp = await requestOtp(email);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "newPassword123" });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "anotherPassword1" });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });

  it("allows login with the new password after a successful reset", async () => {
    const email = "reset-login@example.com";
    await registerTestUser(email);
    const otp = await requestOtp(email);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "newPassword123" });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "newPassword123" });

    expect(loginResponse.status).toBe(200);
    expect((loginResponse.body as AuthSuccessBody).accessToken).toBeTruthy();
  });

  it("allows exactly one of two concurrent reset requests with the same valid OTP to succeed", async () => {
    const email = "reset-concurrent@example.com";
    await registerTestUser(email);
    const otp = await requestOtp(email);

    const [first, second] = await Promise.all([
      request(app)
        .post("/api/auth/reset-password")
        .send({ email, otp, newPassword: "passwordOne1" }),
      request(app)
        .post("/api/auth/reset-password")
        .send({ email, otp, newPassword: "passwordTwo2" }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);
  });
});
