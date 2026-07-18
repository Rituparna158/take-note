import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeExpiredNotes(): Promise<number> {
  const cutoff = new Date(Date.now() - RECOVERY_WINDOW_MS);

  const { count } = await prisma.note.deleteMany({
    where: { deletedAt: { lte: cutoff } },
  });

  logger.info({ purgedCount: count }, "Purged expired soft-deleted notes");

  return count;
}
