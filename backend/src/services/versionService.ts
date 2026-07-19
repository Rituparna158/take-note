import { isDeepStrictEqual } from "node:util";

import type { NoteVersion, Prisma } from "@prisma/client";
import type {
  NoteVersionDetail,
  NoteVersionListItem,
  RestoreVersionResponse,
  TiptapDocument,
} from "@take-note/shared";

import { extractPlainText } from "../lib/tiptapText.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { findOwnedNoteOrThrow } from "./noteService.js";

function toListItem(version: NoteVersion): NoteVersionListItem {
  return {
    id: version.id,
    version: version.version,
    title: version.title,
    savedAt: version.savedAt.toISOString(),
  };
}

function toDetail(version: NoteVersion): NoteVersionDetail {
  return {
    id: version.id,
    version: version.version,
    title: version.title,
    content: version.content as unknown as TiptapDocument,
    savedAt: version.savedAt.toISOString(),
  };
}

export async function computeNextVersion(
  tx: Prisma.TransactionClient,
  noteId: string,
): Promise<number> {
  const result = await tx.noteVersion.aggregate({
    where: { noteId },
    _max: { version: true },
  });

  return (result._max.version ?? 0) + 1;
}

export function hasVersionableChange(
  existing: { title: string; content: unknown },
  incoming: { title: string; content: unknown },
): boolean {
  return (
    existing.title !== incoming.title || !isDeepStrictEqual(existing.content, incoming.content)
  );
}

export async function saveVersionSnapshot(
  tx: Prisma.TransactionClient,
  noteId: string,
  title: string,
  content: Prisma.InputJsonValue,
  bodyText: string,
): Promise<void> {
  const version = await computeNextVersion(tx, noteId);

  await tx.noteVersion.create({
    data: { noteId, title, content, bodyText, version },
  });
}

export async function listVersions(userId: string, noteId: string): Promise<NoteVersionListItem[]> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const versions = await prisma.noteVersion.findMany({
    where: { noteId },
    orderBy: { version: "asc" },
  });

  return versions.map(toListItem);
}

export async function getVersionOrThrow(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<NoteVersionDetail> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const version = await prisma.noteVersion.findUnique({ where: { id: versionId } });

  if (!version || version.noteId !== noteId) {
    throw new AppError(404, "NOT_FOUND", "Version not found");
  }

  return toDetail(version);
}

export async function restoreVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<RestoreVersionResponse> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const target = await prisma.noteVersion.findUnique({ where: { id: versionId } });

  if (!target || target.noteId !== noteId) {
    throw new AppError(404, "NOT_FOUND", "Version not found");
  }

  const bodyText = extractPlainText(target.content as unknown as TiptapDocument);

  const { note, version } = await prisma.$transaction(async (tx) => {
    const updatedNote = await tx.note.update({
      where: { id: noteId },
      data: {
        title: target.title,
        content: target.content as unknown as Prisma.InputJsonValue,
        bodyText,
      },
    });

    const nextVersion = await computeNextVersion(tx, noteId);

    await tx.noteVersion.create({
      data: {
        noteId,
        title: target.title,
        content: target.content as unknown as Prisma.InputJsonValue,
        bodyText,
        version: nextVersion,
      },
    });

    return { note: updatedNote, version: nextVersion };
  });

  return {
    id: note.id,
    title: note.title,
    content: note.content as unknown as TiptapDocument,
    version,
  };
}
