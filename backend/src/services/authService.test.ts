import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { AppError } from "../middleware/errorHandler.js";
import { loginUser, logoutUser, refreshSession, registerUser } from "./authService.js";
import { prisma } from "../lib/prisma.js";

const createdUserIds: string[] = [];

function uniqueEmail(): string {
  return `authservice-test-${randomUUID()}@example.com`;
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

describe("registerUser", () => {
  it("creates an account and returns an access token, user, and refresh token", async () => {
    const email = uniqueEmail();

    const result = await registerUser(email, "password123");
    createdUserIds.push(result.user.id);

    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe(email);
    expect(result.refreshToken.token).toBeTruthy();
  });

  it("rejects a duplicate email registration", async () => {
    const email = uniqueEmail();
    const first = await registerUser(email, "password123");
    createdUserIds.push(first.user.id);

    await expect(registerUser(email, "anotherPassword1")).rejects.toMatchObject({
      statusCode: 422,
      code: "CONFLICT",
    });
  });

  it("treats email uniqueness case-insensitively", async () => {
    const email = uniqueEmail();
    const first = await registerUser(email, "password123");
    createdUserIds.push(first.user.id);

    await expect(registerUser(email.toUpperCase(), "anotherPassword1")).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe("loginUser", () => {
  it("logs in with correct credentials", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    const result = await loginUser(email, "password123");

    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe(email);
  });

  it("rejects an incorrect password with a generic error", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    await expect(loginUser(email, "wrongPassword1")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  });

  it("rejects an unregistered email with the same generic error", async () => {
    await expect(loginUser(uniqueEmail(), "whatever123")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  });
});

describe("logoutUser", () => {
  it("deletes the matching refresh token", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    await logoutUser(registered.refreshToken.token);

    await expect(refreshSession(registered.refreshToken.token)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("succeeds without error when no matching refresh token exists", async () => {
    await expect(logoutUser(undefined)).resolves.toBeUndefined();
    await expect(logoutUser(randomUUID())).resolves.toBeUndefined();
  });
});

describe("refreshSession", () => {
  it("rotates the refresh token and issues a new access token", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    const refreshed = await refreshSession(registered.refreshToken.token);

    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken.token).not.toBe(registered.refreshToken.token);
  });

  it("rejects a reused (already rotated/invalidated) refresh token", async () => {
    const email = uniqueEmail();
    const registered = await registerUser(email, "password123");
    createdUserIds.push(registered.user.id);

    await refreshSession(registered.refreshToken.token);

    await expect(refreshSession(registered.refreshToken.token)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("rejects an unknown/expired refresh token", async () => {
    await expect(refreshSession(randomUUID())).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });
});
