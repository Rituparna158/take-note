import { Prisma } from "@prisma/client";
import type { Tag } from "@prisma/client";
import type {
  CreateTagRequest,
  TagResponse,
  TagWithCountResponse,
  UpdateTagRequest,
} from "@take-note/shared";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

function toTagResponse(tag: Tag): TagResponse {
  return { id: tag.id, name: tag.name, color: tag.color };
}

function toConflictIfUniqueViolation(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return new AppError(422, "CONFLICT", "A tag with this name already exists", {
      name: "Already exists",
    });
  }
  return err;
}

async function assertNameNotTaken(
  userId: string,
  name: string,
  excludeTagId?: string,
): Promise<void> {
  const conflicting = await prisma.tag.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeTagId ? { id: { not: excludeTagId } } : {}),
    },
  });

  if (conflicting) {
    throw new AppError(422, "CONFLICT", "A tag with this name already exists", {
      name: "Already exists",
    });
  }
}

async function findOwnedTagOrThrow(userId: string, tagId: string): Promise<Tag> {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });

  if (!tag) {
    throw new AppError(404, "NOT_FOUND", "Tag not found");
  }

  if (tag.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this tag");
  }

  return tag;
}

export async function createTag(userId: string, input: CreateTagRequest): Promise<TagResponse> {
  await assertNameNotTaken(userId, input.name);

  try {
    const tag = await prisma.tag.create({
      data: { name: input.name, color: input.color, userId },
    });
    return toTagResponse(tag);
  } catch (err) {
    throw toConflictIfUniqueViolation(err);
  }
}

export async function listTagsWithCounts(userId: string): Promise<TagWithCountResponse[]> {
  const [tags, counts] = await Promise.all([
    prisma.tag.findMany({ where: { userId } }),
    prisma.noteTag.groupBy({
      by: ["tagId"],
      where: { note: { userId, deletedAt: null } },
      _count: { tagId: true },
    }),
  ]);

  const countByTagId = new Map(counts.map((entry) => [entry.tagId, entry._count.tagId]));

  return tags.map((tag) => ({
    ...toTagResponse(tag),
    _count: { notes: countByTagId.get(tag.id) ?? 0 },
  }));
}

export async function updateTag(
  userId: string,
  tagId: string,
  input: UpdateTagRequest,
): Promise<TagResponse> {
  const existing = await findOwnedTagOrThrow(userId, tagId);
  await assertNameNotTaken(userId, input.name, existing.id);

  try {
    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: { name: input.name, color: input.color },
    });
    return toTagResponse(updated);
  } catch (err) {
    throw toConflictIfUniqueViolation(err);
  }
}

export async function deleteTag(userId: string, tagId: string): Promise<void> {
  await findOwnedTagOrThrow(userId, tagId);

  await prisma.tag.delete({ where: { id: tagId } });
}

export async function assertTagsOwnedByUser(userId: string, tagIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(tagIds));
  if (uniqueIds.length === 0) {
    return;
  }

  const owned = await prisma.tag.findMany({
    where: { id: { in: uniqueIds }, userId },
    select: { id: true },
  });

  if (owned.length !== uniqueIds.length) {
    throw new AppError(422, "CONFLICT", "One or more tags do not belong to you");
  }
}
