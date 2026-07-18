import { Prisma } from "@prisma/client";
import type {
  NoteSearchResult,
  SearchQuery,
  SearchResponse,
  TagResponse,
  TiptapDocument,
} from "@take-note/shared";

import { prisma } from "../lib/prisma.js";

type SearchRow = {
  id: string;
  title: string;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
  highlight: string;
};

async function fetchTagsByNoteId(noteIds: string[]): Promise<Map<string, TagResponse[]>> {
  if (noteIds.length === 0) {
    return new Map();
  }

  const noteTags = await prisma.noteTag.findMany({
    where: { noteId: { in: noteIds } },
    include: { tag: true },
  });

  const tagsByNoteId = new Map<string, TagResponse[]>();
  for (const noteTag of noteTags) {
    const tags = tagsByNoteId.get(noteTag.noteId) ?? [];
    tags.push({ id: noteTag.tag.id, name: noteTag.tag.name, color: noteTag.tag.color });
    tagsByNoteId.set(noteTag.noteId, tags);
  }
  return tagsByNoteId;
}

export async function searchNotes(userId: string, query: SearchQuery): Promise<SearchResponse> {
  const offset = (query.page - 1) * query.limit;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT
        n.id,
        n.title,
        n.content,
        n."createdAt",
        n."updatedAt",
        ts_headline(
          'english',
          n."bodyText",
          plainto_tsquery('english', ${query.q}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, ShortWord=3'
        ) AS highlight
      FROM "Note" n
      WHERE n."userId" = ${userId}
        AND n."deletedAt" IS NULL
        AND n."searchVector" @@ plainto_tsquery('english', ${query.q})
      ORDER BY ts_rank(n."searchVector", plainto_tsquery('english', ${query.q})) DESC
      LIMIT ${query.limit} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Note" n
      WHERE n."userId" = ${userId}
        AND n."deletedAt" IS NULL
        AND n."searchVector" @@ plainto_tsquery('english', ${query.q})
    `),
  ]);

  const totalCount = Number(countRows[0]?.count ?? 0n);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit);

  const tagsByNoteId = await fetchTagsByNoteId(rows.map((row) => row.id));

  const data: NoteSearchResult[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content as TiptapDocument,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tags: tagsByNoteId.get(row.id) ?? [],
    highlight: row.highlight,
  }));

  return {
    data,
    meta: { totalCount, page: query.page, limit: query.limit, totalPages },
  };
}
