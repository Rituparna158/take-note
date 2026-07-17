import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import type { ErrorBody } from "../test/httpBody.js";
import { resetDatabase } from "../test/resetDatabase.js";

const app = createApp();

async function registerTestUser(email: string): Promise<void> {
  await request(app).post("/api/auth/register").send({ email, password: "password123" });
}

async function requestForgotPasswordOtp(email: string): Promise<{ otp: string; status: number }> {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const response = await request(app).post("/api/auth/forgot-password").send({ email });
  const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
  logSpy.mockRestore();

  const match = /(\d{6})/.exec(logged);
  return { otp: match?.[1] ?? "", status: response.status };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/forgot-password", () => {
  it("generates and stores a 15-minute OTP for an eligible account and responds 200 without exposing it in the response body", async () => {
    const email = "forgot-eligible@example.com";
    await registerTestUser(email);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await request(app).post("/api/auth/forgot-password").send({ email });
    logSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/\d{6}/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.resetOtpHash).not.toBeNull();
    expect(user.resetOtpExpires).not.toBeNull();

    const msUntilExpiry = (user.resetOtpExpires as Date).getTime() - Date.now();
    expect(msUntilExpiry).toBeGreaterThan(14 * 60 * 1000);
    expect(msUntilExpiry).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("logs the plaintext OTP to the console and never includes it in the HTTP response", async () => {
    const email = "forgot-logged@example.com";
    await registerTestUser(email);

    const { otp, status } = await requestForgotPasswordOtp(email);

    expect(status).toBe(200);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("returns the same 200 response for a non-existent email without writing to the database", async () => {
    const email = "forgot-missing@example.com";

    const response = await request(app).post("/api/auth/forgot-password").send({ email });

    expect(response.status).toBe(200);
    expect((response.body as { message: string }).message).toBe(
      "If this email is registered, a password reset code has been generated.",
    );

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it("invalidates a previously issued OTP when a second forgot-password request is made for the same account", async () => {
    const email = "forgot-repeat@example.com";
    await registerTestUser(email);

    const first = await requestForgotPasswordOtp(email);
    const second = await requestForgotPasswordOtp(email);

    expect(first.otp).not.toBe(second.otp);

    const staleAttempt = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp: first.otp, newPassword: "newPassword123" });

    expect(staleAttempt.status).toBe(400);
    expect((staleAttempt.body as ErrorBody).code).toBe("VALIDATION_ERROR");
  });
});
