import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../../test/mocks/server.js";
import { getNoteVersion, getNoteVersions, restoreNoteVersion } from "./versionsApi.js";

const NOTE_ID = "10000000-0000-4000-8000-000000000001";
const VERSION_ID = "30000000-0000-4000-8000-000000000001";
const DOC = { type: "doc" as const, content: [] };

describe("getNoteVersions", () => {
  it("calls GET /api/notes/:id/versions and parses the version list", async () => {
    server.use(
      http.get(`/api/notes/${NOTE_ID}/versions`, () => {
        return HttpResponse.json([
          { id: VERSION_ID, version: 1, title: "First title", savedAt: "2026-07-01T00:00:00Z" },
        ]);
      }),
    );

    const versions = await getNoteVersions(NOTE_ID);

    expect(versions).toEqual([
      { id: VERSION_ID, version: 1, title: "First title", savedAt: "2026-07-01T00:00:00Z" },
    ]);
  });

  it("throws when the response does not match the expected shape", async () => {
    server.use(
      http.get(`/api/notes/${NOTE_ID}/versions`, () => {
        return HttpResponse.json([{ id: VERSION_ID }]);
      }),
    );

    await expect(getNoteVersions(NOTE_ID)).rejects.toThrow();
  });
});

describe("getNoteVersion", () => {
  it("calls GET /api/notes/:id/versions/:versionId and parses the version detail", async () => {
    server.use(
      http.get(`/api/notes/${NOTE_ID}/versions/${VERSION_ID}`, () => {
        return HttpResponse.json({
          id: VERSION_ID,
          version: 1,
          title: "First title",
          content: DOC,
          savedAt: "2026-07-01T00:00:00Z",
        });
      }),
    );

    const version = await getNoteVersion(NOTE_ID, VERSION_ID);

    expect(version).toEqual({
      id: VERSION_ID,
      version: 1,
      title: "First title",
      content: DOC,
      savedAt: "2026-07-01T00:00:00Z",
    });
  });

  it("throws when the response does not match the expected shape", async () => {
    server.use(
      http.get(`/api/notes/${NOTE_ID}/versions/${VERSION_ID}`, () => {
        return HttpResponse.json({ id: VERSION_ID });
      }),
    );

    await expect(getNoteVersion(NOTE_ID, VERSION_ID)).rejects.toThrow();
  });
});

describe("restoreNoteVersion", () => {
  it("calls POST /api/notes/:id/versions/:versionId/restore and parses the restore result", async () => {
    server.use(
      http.post(`/api/notes/${NOTE_ID}/versions/${VERSION_ID}/restore`, () => {
        return HttpResponse.json({
          id: NOTE_ID,
          title: "Restored title",
          content: DOC,
          version: 2,
        });
      }),
    );

    const result = await restoreNoteVersion(NOTE_ID, VERSION_ID);

    expect(result).toEqual({
      id: NOTE_ID,
      title: "Restored title",
      content: DOC,
      version: 2,
    });
  });

  it("throws when the response does not match the expected shape", async () => {
    server.use(
      http.post(`/api/notes/${NOTE_ID}/versions/${VERSION_ID}/restore`, () => {
        return HttpResponse.json({ id: NOTE_ID });
      }),
    );

    await expect(restoreNoteVersion(NOTE_ID, VERSION_ID)).rejects.toThrow();
  });
});
