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
};

function noteId(n: number): string {
  return `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

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
  return {
    id: noteId(n),
    title: `Note ${n}`,
    createdAt: new Date(2026, 0, n).toISOString(),
    updatedAt: new Date(2026, 0, NOTES_FIXTURE_COUNT + 1 - n).toISOString(),
    tagIds,
  };
});

function noteToDto(note: NoteFixture) {
  return {
    id: note.id,
    title: note.title,
    content: { type: "doc", content: [] },
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
