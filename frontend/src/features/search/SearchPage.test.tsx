import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useAuthStore } from "../../stores/authStore.js";
import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import { server } from "../../test/mocks/server.js";
import { SearchPage } from "./SearchPage.js";

const AUTHENTICATED_USER = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
};

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/search"]}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/notes/:id" element={<div>Note editor page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitSearch(query: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Search your notes"), query);
  await user.click(screen.getByRole("button", { name: "Search" }));
  return user;
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

describe("SearchPage", () => {
  it("Submitting a search keyword displays matching notes", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();
    await submitSearch("Note 5");

    expect(await screen.findByRole("heading", { name: "Note 5", level: 2 })).toBeVisible();
  });

  it("Selecting a search result opens it in the editor", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();
    const user = await submitSearch("Note 5");

    const heading = await screen.findByRole("heading", { name: "Note 5", level: 2 });
    const link = heading.closest("a");
    expect(link).not.toBeNull();
    await user.click(link as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("Note editor page")).toBeVisible();
    });
  });

  it("Search result contains visually distinguished match information", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();
    await submitSearch("Note 5");

    await screen.findByRole("heading", { name: "Note 5", level: 2 });
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0]?.textContent?.toLowerCase()).toContain("note 5");
  });

  it("A malicious highlight snippet is sanitized before rendering", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/search", () =>
        HttpResponse.json({
          data: [
            {
              id: "10000000-0000-4000-8000-000000000001",
              title: "Note 1",
              content: { type: "doc", content: [{ type: "paragraph" }] },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: [],
              highlight: "<mark>evil</mark><script>window.__xssFired = true;</script>",
            },
          ],
          meta: { totalCount: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      ),
    );

    renderPage();
    await submitSearch("evil");

    await screen.findByRole("heading", { name: "Note 1", level: 2 });
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as { __xssFired?: boolean }).__xssFired).toBeUndefined();
    expect(document.querySelector("mark")).not.toBeNull();
  });

  it("Navigating search result pages displays the corresponding results", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();
    const user = await submitSearch("Note");

    expect(await screen.findByRole("heading", { name: "Note 1", level: 2 })).toBeVisible();
    expect(screen.getByText("Page 1 of 2")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByRole("heading", { name: "Note 11", level: 2 })).toBeVisible();
    expect(screen.getByText("Page 2 of 2")).toBeVisible();
  });

  it("Search returns no matching notes", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });

    renderPage();
    await submitSearch("zzz-no-match-zzz");

    expect(await screen.findByText("No notes match your search.")).toBeVisible();
  });

  it("Search page before any submission shows an idle prompt", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    let requestCount = 0;
    server.use(
      http.get("/api/search", () => {
        requestCount += 1;
        return HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 10, totalPages: 1 },
        });
      }),
    );

    renderPage();

    expect(await screen.findByText("Enter a keyword and search to find your notes.")).toBeVisible();
    expect(requestCount).toBe(0);
  });

  it("Loading feedback is shown while a search is in flight", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    server.use(
      http.get("/api/search", async () => {
        await delay(50);
        return HttpResponse.json({
          data: [],
          meta: { totalCount: 0, page: 1, limit: 10, totalPages: 1 },
        });
      }),
    );

    renderPage();
    await submitSearch("Note 1");

    expect(screen.getByText("Searching your notes…")).toBeVisible();
    await waitForElementToBeRemoved(() => screen.queryByText("Searching your notes…"));
  });

  it("Failed search displays error feedback with retry control", async () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: AUTHENTICATED_USER,
      status: "authenticated",
    });
    let requestCount = 0;
    server.use(
      http.get("/api/search", () => {
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
    const user = await submitSearch("Note 1");

    const alert = await screen.findByRole("alert");
    expect(alert).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("No notes match your search.")).toBeVisible();
  });
});
