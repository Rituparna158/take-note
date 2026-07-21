import { QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  type RenderResult,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useAuthStore } from "../../stores/authStore.js";
import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import { server } from "../../test/mocks/server.js";
import { TrashPage } from "./TrashPage.js";

const AUTHENTICATED_USER = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
};

const TRASHED_NOTE = {
  id: "10000000-0000-4000-8000-000000000005",
  title: "Deleted Note",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
  tags: [],
};

function renderPage(): RenderResult {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/trash"]}>
        <Routes>
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/" element={<div>Notes list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

describe("TrashPage", () => {
  it("Loading feedback is shown while trashed notes are being fetched", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/notes/trash", async () => {
        await delay(50);
        return HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
        });
      }),
    );

    renderPage();

    expect(screen.getByText("Loading deleted notes…")).toBeVisible();
    await waitForElementToBeRemoved(() => screen.queryByText("Loading deleted notes…"));
  });

  it("Empty trash bin displays an empty state with a link back to notes", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/notes/trash", () =>
        HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Trash Bin is Empty")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to Notes" })).toBeVisible();
  });

  it("Deleted notes are listed with a restore action", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/notes/trash", () =>
        HttpResponse.json({
          data: [TRASHED_NOTE],
          meta: { totalCount: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      ),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "Deleted Note", level: 2 })).toBeVisible();
    expect(screen.getByRole("button", { name: "Restore Note" })).toBeVisible();
  });

  it("Restoring a note calls the restore endpoint and removes it from the trash list", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    let restored = false;
    server.use(
      http.post(`/api/notes/${TRASHED_NOTE.id}/restore`, () => {
        restored = true;
        return HttpResponse.json({ ...TRASHED_NOTE, updatedAt: new Date().toISOString() });
      }),
      http.get("/api/notes/trash", () =>
        HttpResponse.json({
          data: restored ? [] : [TRASHED_NOTE],
          meta: { totalCount: restored ? 0 : 1, page: 1, limit: 20, totalPages: restored ? 0 : 1 },
        }),
      ),
    );

    renderPage();

    await screen.findByRole("heading", { name: "Deleted Note", level: 2 });
    await user.click(screen.getByRole("button", { name: "Restore Note" }));

    await waitFor(() => {
      expect(restored).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Deleted Note", level: 2 }),
      ).not.toBeInTheDocument();
    });
  });

  it("Failed fetch displays error feedback with a retry control", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get("/api/notes/trash", () => {
        requestCount += 1;
        if (requestCount === 1) {
          return HttpResponse.json(
            { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
        });
      }),
    );

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong while loading trash bin.");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Trash Bin is Empty")).toBeVisible();
  });

  it("Back to Notes navigates to the notes list", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    const user = userEvent.setup();
    server.use(
      http.get("/api/notes/trash", () =>
        HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      ),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Back to Notes" }));

    await waitFor(() => {
      expect(screen.getByText("Notes list page")).toBeVisible();
    });
  });
});
