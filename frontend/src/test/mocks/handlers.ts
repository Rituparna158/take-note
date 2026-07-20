import { http, HttpResponse } from "msw";
import type { HttpHandler } from "msw";

export const EXISTING_EMAIL = "existing@example.com";
export const REGISTERED_EMAIL = "user@example.com";
export const REGISTERED_PASSWORD = "correct-password";
export const REGISTERED_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const VALID_OTP = "123456";

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeFakeAccessToken(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.test-signature`;
}

export const FAKE_ACCESS_TOKEN = makeFakeAccessToken({
  sub: REGISTERED_USER_ID,
  email: REGISTERED_EMAIL,
});

export const TAG_WORK_ID = "20000000-0000-4000-8000-000000000001";
export const TAG_PERSONAL_ID = "20000000-0000-4000-8000-000000000002";
export const TAG_URGENT_ID = "20000000-0000-4000-8000-000000000003";

type TagFixture = { id: string; name: string; color: string; count: number };

const TAGS_FIXTURE: TagFixture[] = [
  { id: TAG_WORK_ID, name: "Work", color: "#ff0000", count: 2 },
  { id: TAG_PERSONAL_ID, name: "Personal", color: "#00ff00", count: 2 },
  { id: TAG_URGENT_ID, name: "Urgent", color: "#0000ff", count: 1 },
];

type NoteFixture = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
  content: unknown;
};

function noteId(n: number): string {
  return `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export const NEW_NOTE_ID = "10000000-0000-4000-8000-000000000099";
export const NOT_FOUND_NOTE_ID = "10000000-0000-4000-8000-000000000404";
export const FORBIDDEN_NOTE_ID = "10000000-0000-4000-8000-000000000403";
export const EDITABLE_NOTE_ID = noteId(1);
export const EDITABLE_NOTE_BODY_TEXT = "Note 1 body content";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const NOTES_FIXTURE_COUNT = 12;

const NOTES_FIXTURE: NoteFixture[] = Array.from({ length: NOTES_FIXTURE_COUNT }, (_, index) => {
  const n = index + 1;
  const tagIds =
    n === 1
      ? [TAG_WORK_ID]
      : n === 2
        ? [TAG_PERSONAL_ID]
        : n === 3
          ? [TAG_WORK_ID, TAG_PERSONAL_ID]
          : n === 4
            ? [TAG_URGENT_ID]
            : [];
  const content =
    n === 1
      ? {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: EDITABLE_NOTE_BODY_TEXT }] },
          ],
        }
      : EMPTY_DOC;
  return {
    id: noteId(n),
    title: `Note ${n}`,
    createdAt: new Date(2026, 0, n).toISOString(),
    updatedAt: new Date(2026, 0, NOTES_FIXTURE_COUNT + 1 - n).toISOString(),
    tagIds,
    content,
  };
});

function extractPlainText(node: unknown): string {
  if (node === null || typeof node !== "object") {
    return "";
  }
  const record = node as Record<string, unknown>;
  const ownText = typeof record.text === "string" ? record.text : "";
  const childContent = Array.isArray(record.content)
    ? record.content.map(extractPlainText).join(" ")
    : "";
  return [ownText, childContent].filter(Boolean).join(" ");
}

function buildHighlight(searchableText: string, q: string): string {
  const index = searchableText.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) {
    return searchableText.slice(0, 60);
  }
  const before = searchableText.slice(Math.max(0, index - 20), index);
  const match = searchableText.slice(index, index + q.length);
  const after = searchableText.slice(index + q.length, index + q.length + 20);
  return `${before}<mark>${match}</mark>${after}`;
}

function noteToDto(note: NoteFixture) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    tags: note.tagIds
      .map((tagId) => TAGS_FIXTURE.find((tag) => tag.id === tagId))
      .filter((tag): tag is TagFixture => tag !== undefined)
      .map(({ id, name, color }) => ({ id, name, color })),
  };
}

export const handlers: HttpHandler[] = [
  http.get("/api/notes", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const sortBy = url.searchParams.get("sortBy") === "createdAt" ? "createdAt" : "updatedAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const tagsParam = url.searchParams.get("tags");
    const tagIds = tagsParam ? tagsParam.split(",") : [];

    const filtered = NOTES_FIXTURE.filter((note) =>
      tagIds.every((tagId) => note.tagIds.includes(tagId)),
    );

    const sorted = [...filtered].sort((a, b) => {
      const aValue = new Date(a[sortBy]).getTime();
      const bValue = new Date(b[sortBy]).getTime();
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

    const totalCount = sorted.length;
    const start = (page - 1) * limit;
    const pageNotes = sorted.slice(start, start + limit);

    return HttpResponse.json({
      data: pageNotes.map(noteToDto),
      meta: {
        totalCount,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    });
  }),

  http.post("/api/notes", async ({ request }) => {
    const body = (await request.json()) as {
      title: string;
      content: unknown;
      tagIds?: string[];
    };
    const now = new Date().toISOString();
    return HttpResponse.json(
      noteToDto({
        id: NEW_NOTE_ID,
        title: body.title,
        createdAt: now,
        updatedAt: now,
        tagIds: body.tagIds ?? [],
        content: body.content,
      }),
      { status: 201 },
    );
  }),

  http.get("/api/notes/:id", ({ params }) => {
    const id = params.id as string;

    if (id === FORBIDDEN_NOTE_ID) {
      return HttpResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to this note." },
        { status: 403 },
      );
    }

    if (id === NEW_NOTE_ID) {
      const now = new Date().toISOString();
      return HttpResponse.json(
        noteToDto({
          id: NEW_NOTE_ID,
          title: "Untitled",
          createdAt: now,
          updatedAt: now,
          tagIds: [],
          content: EMPTY_DOC,
        }),
      );
    }

    const note = NOTES_FIXTURE.find((fixture) => fixture.id === id);
    if (!note) {
      return HttpResponse.json({ code: "NOT_FOUND", message: "Note not found." }, { status: 404 });
    }
    return HttpResponse.json(noteToDto(note));
  }),

  http.put("/api/notes/:id", async ({ request, params }) => {
    const id = params.id as string;

    if (id === FORBIDDEN_NOTE_ID) {
      return HttpResponse.json(
        { code: "FORBIDDEN", message: "You do not have access to this note." },
        { status: 403 },
      );
    }

    const existing = NOTES_FIXTURE.find((fixture) => fixture.id === id);
    if (!existing && id !== NEW_NOTE_ID) {
      return HttpResponse.json({ code: "NOT_FOUND", message: "Note not found." }, { status: 404 });
    }

    const body = (await request.json()) as {
      title: string;
      content: unknown;
      tagIds?: string[];
    };
    return HttpResponse.json(
      noteToDto({
        id,
        title: body.title,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tagIds: body.tagIds ?? [],
        content: body.content,
      }),
    );
  }),

  http.post("/api/notes/:id/share", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { expiresInDays?: number };
    const days = body.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return HttpResponse.json(
      {
        shareLink: "http://localhost:5173/share/test-share-token",
        expiresAt,
        viewCount: 0,
        revoked: false,
      },
      { status: 201 },
    );
  }),

  http.delete("/api/notes/:id/share", () => {
    return HttpResponse.json({ message: "Share link revoked successfully" }, { status: 200 });
  }),

  http.get("/api/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "10");

    const matches = NOTES_FIXTURE.filter((note) => {
      const searchableText = `${note.title} ${extractPlainText(note.content)}`;
      return searchableText.toLowerCase().includes(q.toLowerCase());
    });

    const totalCount = matches.length;
    const start = (page - 1) * limit;
    const pageMatches = matches.slice(start, start + limit);

    return HttpResponse.json({
      data: pageMatches.map((note) => ({
        ...noteToDto(note),
        highlight: buildHighlight(`${note.title} ${extractPlainText(note.content)}`, q),
      })),
      meta: {
        totalCount,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    });
  }),

  http.get("/api/tags", () => {
    return HttpResponse.json(
      TAGS_FIXTURE.map(({ id, name, color, count }) => ({
        id,
        name,
        color,
        _count: { notes: count },
      })),
    );
  }),

  http.post("/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === EXISTING_EMAIL) {
      return HttpResponse.json(
        { code: "CONFLICT", message: "This email is already registered." },
        { status: 422 },
      );
    }
    return HttpResponse.json(
      {
        accessToken: FAKE_ACCESS_TOKEN,
        user: { id: REGISTERED_USER_ID, email: body.email },
      },
      { status: 201 },
    );
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === REGISTERED_EMAIL && body.password === REGISTERED_PASSWORD) {
      return HttpResponse.json(
        {
          accessToken: FAKE_ACCESS_TOKEN,
          user: { id: REGISTERED_USER_ID, email: body.email },
        },
        { status: 200 },
      );
    }
    return HttpResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid email or password." },
      { status: 401 },
    );
  }),

  http.post("/api/auth/logout", () => {
    return HttpResponse.json({ message: "Logged out successfully" }, { status: 200 });
  }),

  http.post("/api/auth/refresh", () => {
    return HttpResponse.json({ accessToken: FAKE_ACCESS_TOKEN }, { status: 200 });
  }),

  http.post("/api/auth/forgot-password", () => {
    return HttpResponse.json(
      { message: "If this email is registered, a password reset code has been generated." },
      { status: 200 },
    );
  }),

  http.post("/api/auth/reset-password", async ({ request }) => {
    const body = (await request.json()) as { otp: string };
    if (body.otp !== VALID_OTP) {
      return HttpResponse.json(
        { code: "VALIDATION_ERROR", message: "Invalid or expired code." },
        { status: 400 },
      );
    }
    return HttpResponse.json({ message: "Password reset successful" }, { status: 200 });
  }),
];
