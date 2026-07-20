import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import { EDITABLE_NOTE_ID } from "../../test/mocks/handlers.js";
import { server } from "../../test/mocks/server.js";
import { ShareModal } from "./ShareModal.js";

function renderShareModal(onClose: () => void = () => {}): RenderResult {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ShareModal noteId={EDITABLE_NOTE_ID} open={true} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe("ShareModal", () => {
  it("Note owner opens sharing controls: the sharing interface is displayed", () => {
    renderShareModal();

    expect(screen.getByRole("dialog", { name: "Share note" })).toBeVisible();
  });

  it("Owner generates a share link: the generated public link is displayed", async () => {
    const user = userEvent.setup();
    renderShareModal();

    await user.click(screen.getByRole("button", { name: "Generate link" }));

    expect(await screen.findByText("http://localhost:5173/share/test-share-token")).toBeVisible();
  });

  it("Owner configures supported expiration: the displayed link reflects the selected expiration", async () => {
    const user = userEvent.setup();
    renderShareModal();

    await user.click(screen.getByRole("radio", { name: "14 days" }));
    await user.click(screen.getByRole("button", { name: "Generate link" }));

    const expectedExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(await screen.findByText(`Expires: ${expectedExpiry}`)).toBeVisible();
  });

  it("Owner generates a link without setting expiration: the default expiration is shown as applied", async () => {
    const user = userEvent.setup();
    renderShareModal();

    expect(screen.getByRole("radio", { name: "Use default (7 days)" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Generate link" }));

    const expectedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(await screen.findByText(`Expires: ${expectedExpiry}`)).toBeVisible();
  });

  it("Owner revokes a share link: the link is shown as no longer active", async () => {
    const user = userEvent.setup();
    renderShareModal();

    await user.click(screen.getByRole("button", { name: "Generate link" }));
    await screen.findByText("http://localhost:5173/share/test-share-token");

    await user.click(screen.getByRole("button", { name: "Revoke link" }));

    expect(await screen.findByText("Link revoked. It is no longer active.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Revoke link" })).not.toBeInTheDocument();
  });

  it("Sharing operation fails: the user receives visible failure feedback", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/notes/:id/share", () =>
        HttpResponse.json(
          { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
          { status: 500 },
        ),
      ),
    );
    renderShareModal();

    await user.click(screen.getByRole("button", { name: "Generate link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");

    server.use(
      http.post("/api/notes/:id/share", () =>
        HttpResponse.json(
          {
            shareLink: "http://localhost:5173/share/test-share-token",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            viewCount: 0,
            revoked: false,
          },
          { status: 201 },
        ),
      ),
      http.delete("/api/notes/:id/share", () =>
        HttpResponse.json(
          { code: "INTERNAL_SERVER_ERROR", message: "Could not revoke the link." },
          { status: 500 },
        ),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Generate link" }));
    await screen.findByText("http://localhost:5173/share/test-share-token");

    await user.click(screen.getByRole("button", { name: "Revoke link" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Could not revoke the link.");
    });
    expect(screen.getByRole("button", { name: "Revoke link" })).toBeInTheDocument();
  });
});
