import { createHash, randomUUID } from "node:crypto";

import type {
  GenerateShareLinkRequest,
  PublicShareResponse,
  ShareLinkResponse,
  TiptapDocument,
} from "@take-note/shared";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { findOwnedNoteOrThrow } from "./noteService.js";

const DEFAULT_EXPIRES_IN_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function generateShareLink(
  userId: string,
  noteId: string,
  input: GenerateShareLinkRequest,
): Promise<ShareLinkResponse> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS;
  const expiresAt = new Date(Date.now() + expiresInDays * MS_PER_DAY);
  const token = randomUUID();

  const shareLink = await prisma.$transaction(async (tx) => {
    await tx.shareLink.updateMany({
      where: { noteId, revoked: false },
      data: { revoked: true },
    });

    return tx.shareLink.create({
      data: {
        noteId,
        tokenHash: hashToken(token),
        expiresAt,
        viewCount: 0,
        revoked: false,
      },
    });
  });

  return {
    shareLink: `${process.env.WEB_ORIGIN}/share/${token}`,
    expiresAt: shareLink.expiresAt.toISOString(),
    viewCount: shareLink.viewCount,
    revoked: shareLink.revoked,
  };
}

export async function getActiveShareLink(
  userId: string,
  noteId: string,
): Promise<{ viewCount: number; expiresAt: string; revoked: boolean } | null> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const shareLink = await prisma.shareLink.findFirst({
    where: {
      noteId,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!shareLink) {
    return null;
  }

  return {
    expiresAt: shareLink.expiresAt.toISOString(),
    viewCount: shareLink.viewCount,
    revoked: shareLink.revoked,
  };
}

export async function revokeShareLink(userId: string, noteId: string): Promise<void> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const result = await prisma.shareLink.updateMany({
    where: { noteId, revoked: false },
    data: { revoked: true },
  });

  if (result.count === 0) {
    throw new AppError(404, "NOT_FOUND", "No active share link found for this note");
  }
}

export async function viewSharedNote(token: string): Promise<PublicShareResponse> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!shareLink) {
    throw new AppError(404, "NOT_FOUND", "Share link not found");
  }

  if (shareLink.revoked) {
    throw new AppError(403, "FORBIDDEN", "This share link has been revoked");
  }

  if (shareLink.expiresAt <= new Date()) {
    throw new AppError(403, "FORBIDDEN", "This share link has expired");
  }

  const note = await prisma.note.findUnique({ where: { id: shareLink.noteId } });

  if (!note || note.deletedAt !== null) {
    throw new AppError(404, "NOT_FOUND", "Note not found");
  }

  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { viewCount: { increment: 1 } },
  });

  return {
    title: note.title,
    content: note.content as unknown as TiptapDocument,
    updatedAt: note.updatedAt.toISOString(),
  };
}
