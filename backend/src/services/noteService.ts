import type { Note, Prisma } from "@prisma/client";
import type {
  CreateNoteRequest,
  NoteListResponse,
  NoteResponse,
  TiptapDocument,
  UpdateNoteRequest,
} from "@take-note/shared";

import { extractPlainText } from "../lib/tiptapText.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

type NoteLifecycleRequirement = "active" | "softDeleted";

function toNoteResponse(note: Note): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    content: note.content as unknown as TiptapDocument,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function findOwnedNoteOrThrow(
  userId: string,
  noteId: string,
  requirement: NoteLifecycleRequirement,
): Promise<Note> {
  const note = await prisma.note.findUnique({ where: { id: noteId } });

  if (!note) {
    throw new AppError(404, "NOT_FOUND", "Note not found");
  }

  if (note.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this note");
  }

  const isSoftDeleted = note.deletedAt !== null;
  if (requirement === "active" && isSoftDeleted) {
    throw new AppError(404, "NOT_FOUND", "Note not found");
  }
  if (requirement === "softDeleted" && !isSoftDeleted) {
    throw new AppError(404, "NOT_FOUND", "Note not found");
  }

  return note;
}

export async function createNote(userId: string, input: CreateNoteRequest): Promise<NoteResponse> {
  const bodyText = extractPlainText(input.content);

  const note = await prisma.note.create({
    data: {
      title: input.title,
      content: input.content as unknown as Prisma.InputJsonValue,
      bodyText,
      userId,
    },
  });

  return toNoteResponse(note);
}

export async function getActiveNoteById(userId: string, noteId: string): Promise<NoteResponse> {
  const note = await findOwnedNoteOrThrow(userId, noteId, "active");
  return toNoteResponse(note);
}

export async function listActiveNotes(userId: string): Promise<NoteListResponse> {
  const notes = await prisma.note.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  const data = notes.map(toNoteResponse);
  const totalCount = data.length;

  return {
    data,
    meta: { totalCount, page: 1, limit: totalCount, totalPages: 1 },
  };
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: UpdateNoteRequest,
): Promise<NoteResponse> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  const bodyText = extractPlainText(input.content);

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: {
      title: input.title,
      content: input.content as unknown as Prisma.InputJsonValue,
      bodyText,
    },
  });

  return toNoteResponse(updated);
}

export async function softDeleteNote(userId: string, noteId: string): Promise<void> {
  await findOwnedNoteOrThrow(userId, noteId, "active");

  await prisma.note.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });
}

export async function restoreNote(userId: string, noteId: string): Promise<void> {
  await findOwnedNoteOrThrow(userId, noteId, "softDeleted");

  await prisma.note.update({
    where: { id: noteId },
    data: { deletedAt: null },
  });
}
