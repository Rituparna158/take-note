import { createHash, randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issue(userId: string): Promise<IssuedRefreshToken> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  return { token, expiresAt };
}

export async function verifyAndConsume(plainToken: string): Promise<{ userId: string } | null> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(plainToken) },
  });

  if (!record || record.expiresAt <= new Date()) {
    return null;
  }

  return { userId: record.userId };
}

export async function rotate(plainToken: string): Promise<RotatedRefreshToken | null> {
  const tokenHash = hashToken(plainToken);
  const newToken = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const record = await tx.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.expiresAt <= new Date()) {
      return null;
    }

    await tx.refreshToken.delete({ where: { tokenHash } });
    await tx.refreshToken.create({
      data: { tokenHash: hashToken(newToken), userId: record.userId, expiresAt },
    });

    return { token: newToken, expiresAt, userId: record.userId };
  });
}

export async function revoke(plainToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(plainToken) } });
}
