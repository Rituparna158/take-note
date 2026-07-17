import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { issue, revoke, rotate, verifyAndConsume } from "./refreshTokenService.js";

let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `refresh-token-test-${randomUUID()}@example.com`, passwordHash: "irrelevant" },
  });
  userId = user.id;
});

afterEach(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("issue", () => {
  it("persists a hashed token row and returns the plaintext token", async () => {
    const { token, expiresAt } = await issue(userId);

    expect(token).toBeTruthy();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const stored = await prisma.refreshToken.findFirst({ where: { userId } });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(token);
  });
});

describe("verifyAndConsume", () => {
  it("returns the userId for a valid, unexpired token", async () => {
    const { token } = await issue(userId);

    await expect(verifyAndConsume(token)).resolves.toEqual({ userId });
  });

  it("returns null for an unknown token", async () => {
    await expect(verifyAndConsume(randomUUID())).resolves.toBeNull();
  });

  it("returns null for an expired token", async () => {
    const { token } = await issue(userId);
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(verifyAndConsume(token)).resolves.toBeNull();
  });
});

describe("rotate", () => {
  it("invalidates the old token and issues a new one", async () => {
    const { token: oldToken } = await issue(userId);

    const rotated = await rotate(oldToken);

    expect(rotated).not.toBeNull();
    expect(rotated?.userId).toBe(userId);
    expect(rotated?.token).not.toBe(oldToken);
    await expect(verifyAndConsume(oldToken)).resolves.toBeNull();
    await expect(verifyAndConsume(rotated?.token as string)).resolves.toEqual({ userId });
  });

  it("returns null when rotating an unknown token", async () => {
    await expect(rotate(randomUUID())).resolves.toBeNull();
  });

  it("returns null when rotating an expired token", async () => {
    const { token } = await issue(userId);
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(rotate(token)).resolves.toBeNull();
  });
});

describe("revoke", () => {
  it("deletes an existing token", async () => {
    const { token } = await issue(userId);

    await revoke(token);

    await expect(verifyAndConsume(token)).resolves.toBeNull();
  });

  it("is a no-op when the token does not exist", async () => {
    await expect(revoke(randomUUID())).resolves.toBeUndefined();
  });
});
