import { prisma } from "../lib/prisma.js";

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "RefreshToken", "User" CASCADE');
}
