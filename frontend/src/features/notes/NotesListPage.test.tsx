import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../stores/authStore.js";
import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import { server } from "../../test/mocks/server.js";
import { NotesListPage } from "./NotesListPage.js";

const AUTHENTICATED_USER = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
};

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<NotesListPage />} />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/notes/new" element={<div>New note editor page</div>} />
          <Route path="/notes/:id" element={<div>Note editor page</div>} />
          <Route path="/search" element={<div>Search page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function noteHeadings() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

describe("NotesListPage", () => {
  it("Authenticated user views their active notes", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Note 1", level: 2 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Note 10", level: 2 })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Note 11", level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeVisible();

    const note1Item = screen.getByRole("heading", { name: "Note 1", level: 2 }).closest("li");
    expect(note1Item).not.toBeNull();
    expect(within(note1Item as HTMLElement).getByText(/Created/)).toBeVisible();
    expect(within(note1Item as HTMLElement).getByText(/Updated/)).toBeVisible();
  });

  it("Loading feedback is shown while notes are being fetched", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/notes", async () => {
        await delay(50);
        return HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 10, totalPages: 1 },
        });
      }),
    );

    renderPage();

    expect(screen.getByText("Loading your notes…")).toBeVisible();
    await waitForElementToBeRemoved(() => screen.queryByText("Loading your notes…"));
  });

  it("Changing page displays the corresponding notes", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole("heading", { name: "Note 1", level: 2 });

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByRole("heading", { name: "Note 11", level: 2 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Note 12", level: 2 })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Note 1", level: 2 })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Page 2 of 2")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Previous page" }));

    expect(await screen.findByRole("heading", { name: "Note 1", level: 2 })).toBeVisible();
    expect(screen.getByText("Page 1 of 2")).toBeVisible();
  });

  it("Changing sort updates the displayed note order", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole("heading", { name: "Note 1", level: 2 });
    expect(noteHeadings()[0]).toBe("Note 1");

    await user.selectOptions(screen.getByLabelText("Sort by"), "createdAt");

    await waitFor(() => {
      expect(noteHeadings()[0]).toBe("Note 12");
    });

    await user.selectOptions(screen.getByLabelText("Order"), "asc");

    await waitFor(() => {
      expect(noteHeadings()[0]).toBe("Note 1");
    });
  });

  it("Applying a single tag filter displays matching notes", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole("heading", { name: "Note 1", level: 2 });

    await user.click(screen.getByRole("checkbox", { name: "Work" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Note 1", level: 2 })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Note 3", level: 2 })).toBeVisible();
      expect(screen.queryByRole("heading", { name: "Note 2", level: 2 })).not.toBeInTheDocument();
    });
  });

  it("Applying multiple tag filters displays only notes matching all selected tags", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole("heading", { name: "Note 1", level: 2 });

    await user.click(screen.getByRole("checkbox", { name: "Work" }));
    await user.click(screen.getByRole("checkbox", { name: "Personal" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Note 3", level: 2 })).toBeVisible();
      expect(screen.queryByRole("heading", { name: "Note 1", level: 2 })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Note 2", level: 2 })).not.toBeInTheDocument();
    });
  });

  it("No notes exist for the user", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/notes", () =>
        HttpResponse.json({ data: [], meta: { totalCount: 0, page: 1, limit: 10, totalPages: 1 } }),
      ),
    );

    renderPage();

    expect(await screen.findByText("You have no notes yet.")).toBeVisible();
  });

  it("No notes match the current tag filter", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole("heading", { name: "Note 1", level: 2 });

    await user.click(screen.getByRole("checkbox", { name: "Personal" }));
    await user.click(screen.getByRole("checkbox", { name: "Urgent" }));

    expect(await screen.findByText("No notes match the selected filters.")).toBeVisible();
  });

  it("Header displays the signed-in user's email", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();

    expect(await screen.findByText(AUTHENTICATED_USER.email)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Take Note", level: 1 })).toBeVisible();
  });

  it("Logout ends the session and returns to login", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeVisible();
    });
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("New Note action opens the editor for a new note", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "New Note" }));

    await waitFor(() => {
      expect(screen.getByText("New note editor page")).toBeVisible();
    });
  });

  it("Header provides navigation to the search page", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("link", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Search page")).toBeVisible();
    });
  });

  it("Selecting a note in the list opens it in the editor", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderPage();

    const heading = await screen.findByRole("heading", { name: "Note 1", level: 2 });
    const link = heading.closest("a");
    expect(link).not.toBeNull();
    await user.click(link as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("Note editor page")).toBeVisible();
    });
  });

  it("Deleting a note asks for confirmation, then removes it from the list", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const NOTE_ID = "10000000-0000-4000-8000-000000000001";
    let deleted = false;
    server.use(
      http.delete("/api/notes/:id", () => {
        deleted = true;
        return HttpResponse.json({ message: "Note deleted" });
      }),
      http.get("/api/notes", () =>
        HttpResponse.json({
          data: deleted
            ? []
            : [
                {
                  id: NOTE_ID,
                  title: "Note 1",
                  content: { type: "doc", content: [{ type: "paragraph" }] },
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                  tags: [],
                },
              ],
          meta: { totalCount: deleted ? 0 : 1, page: 1, limit: 10, totalPages: 1 },
        }),
      ),
    );

    renderPage();

    const note1Item = (await screen.findByRole("heading", { name: "Note 1", level: 2 })).closest(
      "li",
    ) as HTMLElement;
    await user.click(within(note1Item).getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to delete "Note 1"'),
    );
    await waitFor(() => {
      expect(deleted).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Note 1", level: 2 })).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it("Declining the delete confirmation keeps the note in the list", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    let deleteCallCount = 0;
    server.use(
      http.delete("/api/notes/:id", () => {
        deleteCallCount += 1;
        return HttpResponse.json({ message: "Note deleted" });
      }),
    );

    renderPage();

    const note1Item = (await screen.findByRole("heading", { name: "Note 1", level: 2 })).closest(
      "li",
    ) as HTMLElement;
    await user.click(within(note1Item).getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteCallCount).toBe(0);
    expect(screen.getByRole("heading", { name: "Note 1", level: 2 })).toBeVisible();

    confirmSpy.mockRestore();
  });

  it("Failed fetch displays error feedback with retry control", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get("/api/notes", () => {
        requestCount += 1;
        if (requestCount === 1) {
          return HttpResponse.json(
            { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 10, totalPages: 1 },
        });
      }),
    );

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Something went wrong while loading your notes.")).toBeVisible();

    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("You have no notes yet.")).toBeVisible();
  });
});
