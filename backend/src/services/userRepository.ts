import type { User } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function create(email: string, passwordHash: string): Promise<User> {
  return prisma.user.create({ data: { email, passwordHash } });
}

export async function setResetOtp(userId: string, otpHash: string, expiresAt: Date): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { resetOtpHash: otpHash, resetOtpExpires: expiresAt },
  });
}

export interface ConsumePasswordResetInput {
  email: string;
  expectedOtpHash: string;
  passwordHash: string;
  now: Date;
}

export async function consumePasswordReset(input: ConsumePasswordResetInput): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: {
      email: input.email,
      resetOtpHash: input.expectedOtpHash,
      resetOtpExpires: { gt: input.now },
    },
    data: {
      passwordHash: input.passwordHash,
      resetOtpHash: null,
      resetOtpExpires: null,
    },
  });

  return result.count === 1;
}
