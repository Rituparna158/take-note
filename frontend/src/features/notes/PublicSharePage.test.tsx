import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PublicSharePage } from "./PublicSharePage.js";

const server = setupServer(
  http.get("/api/share/valid-share-token", () => {
    return HttpResponse.json({
      title: "Shared Test Note",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Shared note text content" }] },
        ],
      },
      updatedAt: "2026-07-21T10:00:00.000Z",
    });
  }),
  http.get("/api/share/invalid-token", () => {
    return new HttpResponse(
      JSON.stringify({ code: "FORBIDDEN", message: "This share link has been revoked" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPublicSharePage(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<PublicSharePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicSharePage", () => {
  it("fetches and displays the public shared note without authentication", async () => {
    renderPublicSharePage("valid-share-token");

    expect(screen.getByRole("status")).toHaveTextContent("Loading shared note…");

    expect(await screen.findByText("Shared Test Note")).toBeInTheDocument();
    expect(screen.getByText("Public Shared Note (Read-Only)")).toBeInTheDocument();
  });

  it("displays error message when share token is invalid or revoked", async () => {
    renderPublicSharePage("invalid-token");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Unable to view note")).toBeInTheDocument();
  });
});
