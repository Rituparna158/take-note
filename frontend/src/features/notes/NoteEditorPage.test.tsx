import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useEditorStore } from "../../stores/editorStore.js";
import { useNoteStore } from "../../stores/noteStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import {
  EDITABLE_NOTE_BODY_TEXT,
  EDITABLE_NOTE_ID,
  NEW_NOTE_ID,
  TAG_PERSONAL_ID,
} from "../../test/mocks/handlers.js";
import { server } from "../../test/mocks/server.js";
import { NoteEditorPage } from "./NoteEditorPage.js";

type CapturedPutBody = { title: string; content: unknown; tagIds?: string[] };

function capturePutRequests(): CapturedPutBody[] {
  const bodies: CapturedPutBody[] = [];
  server.use(
    http.put("/api/notes/:id", async ({ request, params }) => {
      const body = (await request.json()) as CapturedPutBody;
      bodies.push(body);
      return HttpResponse.json({
        id: params.id as string,
        title: body.title,
        content: body.content,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        tags: [],
      });
    }),
  );
  return bodies;
}

type CapturedPostBody = { title: string; content: unknown; tagIds?: string[] };

function capturePostRequests(): CapturedPostBody[] {
  const bodies: CapturedPostBody[] = [];
  server.use(
    http.post("/api/notes", async ({ request }) => {
      const body = (await request.json()) as CapturedPostBody;
      bodies.push(body);
      return HttpResponse.json(
        {
          id: NEW_NOTE_ID,
          title: body.title,
          content: body.content,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          tags: [],
        },
        { status: 201 },
      );
    }),
  );
  return bodies;
}

const AUTHENTICATED_USER = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
};

function renderEditor(initialPath: string) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div>Notes list page</div>} />
          <Route path="/notes/new" element={<NoteEditorPage />} />
          <Route path="/notes/:id" element={<NoteEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderEditorStrict(initialPath: string) {
  const queryClient = createTestQueryClient();
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/" element={<div>Notes list page</div>} />
            <Route path="/notes/new" element={<NoteEditorPage />} />
            <Route path="/notes/:id" element={<NoteEditorPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
  useEditorStore.getState().reset();
  useNoteStore.getState().clearOpenNoteId();
});

describe("NoteEditorPage", () => {
  it("Creating a new note opens the rich-text editor", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const postBodies = capturePostRequests();

    const { container } = renderEditor("/notes/new");

    expect(await screen.findByLabelText("Note title")).toHaveValue("Untitled");
    expect(container.querySelector(".ProseMirror")).not.toBeNull();
    await waitFor(() => {
      expect(postBodies.length).toBe(1);
    });
    expect(postBodies[0]?.title).toBe("Untitled");
  });

  it("Only one note is created under React StrictMode's double-invoked mount effects", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const postBodies = capturePostRequests();

    renderEditorStrict("/notes/new");

    expect(await screen.findByLabelText("Note title")).toHaveValue("Untitled");
    await waitFor(() => {
      expect(postBodies.length).toBeGreaterThan(0);
    });
    // Give any erroneous second StrictMode-triggered request a chance to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(postBodies.length).toBe(1);
  });

  it("Content typed during note creation is not discarded", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    server.use(
      http.post("/api/notes", async ({ request }) => {
        const body = (await request.json()) as { title: string; content: unknown };
        await delay(1000);
        return HttpResponse.json(
          {
            id: NEW_NOTE_ID,
            title: body.title,
            content: body.content,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            tags: [],
          },
          { status: 201 },
        );
      }),
    );
    const putBodies = capturePutRequests();

    const { container } = renderEditor("/notes/new");
    await screen.findByLabelText("Note title");
    const proseMirror = container.querySelector(".ProseMirror") as HTMLElement;
    await user.click(proseMirror);
    await user.type(proseMirror, "typed while creating");

    // The POST resolves (300ms) after this text is typed, using a stale empty-content
    // snapshot taken when the request was fired; the subsequent autosave must still pick
    // up and persist the drift instead of treating the stale snapshot as "nothing changed".
    await waitFor(
      () => {
        expect(putBodies.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
    const lastBody = putBodies.at(-1);
    expect(JSON.stringify(lastBody?.content)).toContain("typed while creating");
  }, 8000);

  it("Back to Notes clicked before creation resolves still persists the typed title, content, and tag", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    server.use(
      http.post("/api/notes", async ({ request }) => {
        const body = (await request.json()) as { title: string; content: unknown };
        await delay(1000);
        return HttpResponse.json(
          {
            id: NEW_NOTE_ID,
            title: body.title,
            content: body.content,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            tags: [],
          },
          { status: 201 },
        );
      }),
    );
    const putBodies = capturePutRequests();

    const { container } = renderEditor("/notes/new");
    const titleInput = await screen.findByLabelText("Note title");

    // All of this happens while the initial "Untitled" creation POST (1000ms) is
    // still in flight, i.e. noteId is still null.
    fireEvent.change(titleInput, { target: { value: "Race Note" } });
    const proseMirror = container.querySelector(".ProseMirror") as HTMLElement;
    await user.click(proseMirror);
    await user.type(proseMirror, "typed before create resolved");
    await user.click(await screen.findByRole("checkbox", { name: "Personal" }));
    await user.click(screen.getByRole("button", { name: /Back to Notes/ }));

    await waitFor(
      () => {
        expect(screen.getByText("Notes list page")).toBeVisible();
      },
      { timeout: 5000 },
    );

    const lastBody = putBodies.at(-1);
    expect(lastBody).toBeDefined();
    expect(lastBody?.title).toBe("Race Note");
    expect(JSON.stringify(lastBody?.content)).toContain("typed before create resolved");
    expect(lastBody?.tagIds).toContain(TAG_PERSONAL_ID);
  }, 8000);

  it("Opening an existing note loads its content into the editor", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    expect(await screen.findByLabelText("Note title")).toHaveValue("Note 1");
    expect(await screen.findByText(EDITABLE_NOTE_BODY_TEXT)).toBeVisible();
  });

  it("Changed rich-text content can be saved", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    const putBodies = capturePutRequests();

    const { container } = renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    await screen.findByText(EDITABLE_NOTE_BODY_TEXT);
    const proseMirror = container.querySelector(".ProseMirror") as HTMLElement;
    await user.click(proseMirror);
    await user.type(proseMirror, " more text");

    await waitFor(
      () => {
        expect(putBodies.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    const lastBody = putBodies.at(-1);
    expect(lastBody).toBeDefined();
    expect(JSON.stringify(lastBody?.content)).toContain("more text");
  }, 6000);

  it("Assigning an accessible tag associates it with the note", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    const putBodies = capturePutRequests();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    await screen.findByLabelText("Note title");
    await user.click(await screen.findByRole("checkbox", { name: "Personal" }));

    await waitFor(
      () => {
        expect(putBodies.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    const lastBody = putBodies.at(-1);
    expect(lastBody).toBeDefined();
    expect(lastBody?.tagIds).toContain(TAG_PERSONAL_ID);
  }, 6000);

  it("Changed content is automatically saved after inactivity", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const putBodies = capturePutRequests();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);
    const titleInput = await screen.findByLabelText("Note title");

    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    await waitFor(
      () => {
        expect(putBodies.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    const lastBody = putBodies.at(-1);
    expect(lastBody?.title).toBe("Updated Title");
  }, 6000);

  it("Unnecessary autosave is not performed", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const putBodies = capturePutRequests();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);
    await screen.findByLabelText("Note title");

    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(putBodies.length).toBe(0);
  }, 6000);

  it("Successful autosave is identifiable to the user", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    capturePutRequests();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);
    const titleInput = await screen.findByLabelText("Note title");

    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    expect(await screen.findByText("Saved", {}, { timeout: 3000 })).toBeVisible();
  }, 6000);

  it("Autosave retries before notifying the user of failure", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    let putAttempts = 0;
    server.use(
      http.put("/api/notes/:id", () => {
        putAttempts += 1;
        return HttpResponse.json(
          { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
          { status: 500 },
        );
      }),
    );

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);
    const titleInput = await screen.findByLabelText("Note title");

    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    expect(await screen.findByText(/Retrying save/, {}, { timeout: 4000 })).toBeVisible();
    expect(putAttempts).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
  }, 8000);

  it("Autosave failure is shown after retries are exhausted", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    let putAttempts = 0;
    server.use(
      http.put("/api/notes/:id", () => {
        putAttempts += 1;
        return HttpResponse.json(
          { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
          { status: 500 },
        );
      }),
    );

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);
    const titleInput = await screen.findByLabelText("Note title");

    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    expect(await screen.findByText(/could not be saved/, {}, { timeout: 12000 })).toBeVisible();
    expect(putAttempts).toBe(4);
  }, 15000);

  it("Creation failure: Retry re-attempts creation and succeeds", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    let postAttempts = 0;
    server.use(
      http.post("/api/notes", async ({ request }) => {
        postAttempts += 1;
        if (postAttempts === 1) {
          return HttpResponse.json(
            { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
            { status: 500 },
          );
        }
        const body = (await request.json()) as { title: string; content: unknown };
        return HttpResponse.json(
          {
            id: NEW_NOTE_ID,
            title: body.title,
            content: body.content,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            tags: [],
          },
          { status: 201 },
        );
      }),
    );

    renderEditor("/notes/new");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Something went wrong while creating your note.")).toBeVisible();

    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Note title")).toHaveValue("Untitled");
  });

  it("Creation failure: Back to Notes navigates to the notes list", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    server.use(
      http.post("/api/notes", () =>
        HttpResponse.json(
          { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
          { status: 500 },
        ),
      ),
    );

    renderEditor("/notes/new");

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Back to Notes" }));

    await waitFor(() => {
      expect(screen.getByText("Notes list page")).toBeVisible();
    });
  });

  it("Fetch failure: Retry re-attempts the fetch and succeeds", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    let getAttempts = 0;
    server.use(
      http.get("/api/notes/:id", () => {
        getAttempts += 1;
        if (getAttempts === 1) {
          return HttpResponse.json(
            { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          id: EDITABLE_NOTE_ID,
          title: "Note 1",
          content: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: EDITABLE_NOTE_BODY_TEXT }] },
            ],
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          tags: [],
        });
      }),
    );

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Something went wrong while loading this note.")).toBeVisible();

    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Note title")).toHaveValue("Note 1");
  });

  it("The Share button opens the share modal for a persisted note", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    await screen.findByLabelText("Note title");
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("dialog", { name: "Share note" })).toBeVisible();
  });

  it("The History button is not shown until a new note has been created", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.post("/api/notes", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );

    renderEditor("/notes/new");

    await screen.findByLabelText("Note title");
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
  });

  it("The History button opens the version-history drawer for a persisted note", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    await screen.findByLabelText("Note title");
    await user.click(screen.getByRole("button", { name: "History" }));

    expect(await screen.findByRole("dialog", { name: "Version history" })).toBeVisible();
  });

  it("Restoring a version updates the displayed title and content", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    await screen.findByText(EDITABLE_NOTE_BODY_TEXT);
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(await screen.findByRole("button", { name: "Version 1 — 2026-01-01" }));
    await user.click(await screen.findByRole("button", { name: "Restore version 1" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Note title")).toHaveValue("Note 1 (draft)");
    });
    expect(screen.queryByText(EDITABLE_NOTE_BODY_TEXT)).not.toBeInTheDocument();
  });

  it("Restoring a version does not trigger a redundant autosave save", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    const putBodies = capturePutRequests();

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    await screen.findByText(EDITABLE_NOTE_BODY_TEXT);
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(await screen.findByRole("button", { name: "Version 1 — 2026-01-01" }));
    await user.click(await screen.findByRole("button", { name: "Restore version 1" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Note title")).toHaveValue("Note 1 (draft)");
    });

    // Wait past the 2s autosave debounce; restoring must not queue a follow-up PUT
    // on top of the restore the drawer already performed.
    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(putBodies.length).toBe(0);
  }, 6000);

  it("Fetch failure: Back to Notes navigates to the notes list", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    server.use(
      http.get("/api/notes/:id", () =>
        HttpResponse.json({ code: "NOT_FOUND", message: "Note not found." }, { status: 404 }),
      ),
    );

    renderEditor(`/notes/${EDITABLE_NOTE_ID}`);

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Back to Notes" }));

    await waitFor(() => {
      expect(screen.getByText("Notes list page")).toBeVisible();
    });
  });
});
