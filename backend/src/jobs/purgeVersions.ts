import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

const VERSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeExpiredVersions(): Promise<number> {
  const cutoff = new Date(Date.now() - VERSION_RETENTION_MS);

  const { count } = await prisma.noteVersion.deleteMany({
    where: { savedAt: { lte: cutoff } },
  });

  logger.info({ purgedCount: count }, "Purged expired note versions");

  return count;
}
