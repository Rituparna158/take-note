import type { Note, NoteTag, Prisma, Tag } from "@prisma/client";
import type {
  CreateNoteRequest,
  ListNotesQuery,
  NoteListResponse,
  NoteResponse,
  TiptapDocument,
  UpdateNoteRequest,
} from "@take-note/shared";

import { extractPlainText } from "../lib/tiptapText.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { assertTagsOwnedByUser } from "./tagService.js";
import { hasVersionableChange, saveVersionSnapshot } from "./versionService.js";

type NoteLifecycleRequirement = "active" | "softDeleted";

type NoteWithTags = Note & { tags: (NoteTag & { tag: Tag })[] };

const noteWithTagsInclude = { tags: { include: { tag: true } } } satisfies Prisma.NoteInclude;

function toNoteResponse(note: NoteWithTags): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    content: note.content as unknown as TiptapDocument,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    tags: note.tags.map((noteTag) => ({
      id: noteTag.tag.id,
      name: noteTag.tag.name,
      color: noteTag.tag.color,
    })),
  };
}

function dedupeTagIds(tagIds: string[] | undefined): string[] {
  return tagIds ? Array.from(new Set(tagIds)) : [];
}

export async function findOwnedNoteOrThrow(
  userId: string,
  noteId: string,
  requirement: NoteLifecycleRequirement,
): Promise<NoteWithTags> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: noteWithTagsInclude,
  });

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
  const tagIds = dedupeTagIds(input.tagIds);

  if (tagIds.length > 0) {
    await assertTagsOwnedByUser(userId, tagIds);
  }

  const note = await prisma.note.create({
    data: {
      title: input.title,
      content: input.content as unknown as Prisma.InputJsonValue,
      bodyText,
      userId,
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
      versions: {
        create: {
          title: input.title,
          content: input.content as unknown as Prisma.InputJsonValue,
          bodyText,
          version: 1,
        },
      },
    },
    include: noteWithTagsInclude,
  });

  return toNoteResponse(note);
}

export async function getActiveNoteById(userId: string, noteId: string): Promise<NoteResponse> {
  const note = await findOwnedNoteOrThrow(userId, noteId, "active");
  return toNoteResponse(note);
}

export async function listActiveNotes(
  userId: string,
  query: ListNotesQuery,
): Promise<NoteListResponse> {
  const where: Prisma.NoteWhereInput = {
    userId,
    deletedAt: null,
    ...(query.tags && query.tags.length > 0
      ? { AND: query.tags.map((tagId) => ({ tags: { some: { tagId } } })) }
      : {}),
  };

  const [notes, totalCount] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: noteWithTagsInclude,
    }),
    prisma.note.count({ where }),
  ]);

  const data = notes.map(toNoteResponse);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);

  return {
    data,
    meta: { totalCount, page: query.page, limit: query.limit, totalPages },
  };
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: UpdateNoteRequest,
): Promise<NoteResponse> {
  const existing = await findOwnedNoteOrThrow(userId, noteId, "active");

  const bodyText = extractPlainText(input.content);
  const tagIds = input.tagIds !== undefined ? dedupeTagIds(input.tagIds) : undefined;

  if (tagIds && tagIds.length > 0) {
    await assertTagsOwnedByUser(userId, tagIds);
  }

  const shouldSaveVersion = hasVersionableChange(
    { title: existing.title, content: existing.content },
    { title: input.title, content: input.content },
  );

  const updated = await prisma.$transaction(async (tx) => {
    if (tagIds) {
      await tx.noteTag.deleteMany({ where: { noteId } });
      await tx.noteTag.createMany({ data: tagIds.map((tagId) => ({ noteId, tagId })) });
    }

    const updatedNote = await tx.note.update({
      where: { id: noteId },
      data: {
        title: input.title,
        content: input.content as unknown as Prisma.InputJsonValue,
        bodyText,
      },
      include: noteWithTagsInclude,
    });

    if (shouldSaveVersion) {
      await saveVersionSnapshot(
        tx,
        noteId,
        input.title,
        input.content as unknown as Prisma.InputJsonValue,
        bodyText,
      );
    }

    return updatedNote;
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
