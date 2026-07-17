import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { hashOtp } from "../lib/otp.js";
import { prisma } from "../lib/prisma.js";
import { registerUser } from "./authService.js";
import { requestPasswordReset, resetPassword } from "./passwordResetService.js";

const createdUserIds: string[] = [];

function uniqueEmail(): string {
  return `password-reset-test-${randomUUID()}@example.com`;
}

async function requestOtpFor(email: string): Promise<string> {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  await requestPasswordReset(email);
  const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
  logSpy.mockRestore();

  const match = /: (\d{6}) \(expires/.exec(logged);
  const otp = match?.[1];
  if (!otp) {
    throw new Error("Expected an OTP to be logged to the console");
  }
  return otp;
}

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("requestPasswordReset", () => {
  it("generates and stores a hashed OTP with a 15-minute expiry for an eligible account", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    const otp = await requestOtpFor(email);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: registered.user.id } });
    expect(user.resetOtpHash).toBe(hashOtp(otp));
    expect(user.resetOtpExpires).not.toBeNull();

    const msUntilExpiry = (user.resetOtpExpires as Date).getTime() - Date.now();
    expect(msUntilExpiry).toBeGreaterThan(14 * 60 * 1000);
    expect(msUntilExpiry).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("does nothing for a non-existent account", async () => {
    await expect(requestPasswordReset(uniqueEmail())).resolves.toBeUndefined();
  });
});

describe("resetPassword", () => {
  it("resets the password with a valid unexpired OTP", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    const otp = await requestOtpFor(email);

    await expect(resetPassword(email, otp, "newPassword123")).resolves.toBeUndefined();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: registered.user.id } });
    expect(user.resetOtpHash).toBeNull();
    expect(user.resetOtpExpires).toBeNull();
  });

  it("rejects an invalid OTP", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    await requestOtpFor(email);

    await expect(resetPassword(email, "000000", "newPassword123")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects an expired OTP", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    const otp = await requestOtpFor(email);
    await prisma.user.update({
      where: { id: registered.user.id },
      data: { resetOtpExpires: new Date(Date.now() - 1000) },
    });

    await expect(resetPassword(email, otp, "newPassword123")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects reusing a previously consumed OTP", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    const otp = await requestOtpFor(email);
    await resetPassword(email, otp, "newPassword123");

    await expect(resetPassword(email, otp, "anotherPassword1")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });
});
