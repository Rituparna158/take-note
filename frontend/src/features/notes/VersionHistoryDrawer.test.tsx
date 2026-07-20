import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import { EDITABLE_NOTE_ID } from "../../test/mocks/handlers.js";
import { VersionHistoryDrawer } from "./VersionHistoryDrawer.js";

function renderDrawer(
  overrides: Partial<{
    open: boolean;
    onClose: () => void;
    onRestored: (result: unknown) => void;
  }> = {},
): RenderResult {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <VersionHistoryDrawer
        noteId={EDITABLE_NOTE_ID}
        open={overrides.open ?? true}
        onClose={overrides.onClose ?? (() => {})}
        onRestored={overrides.onRestored ?? (() => {})}
      />
    </QueryClientProvider>,
  );
}

describe("VersionHistoryDrawer", () => {
  it("Note owner opens version history: the version-history drawer is displayed", () => {
    renderDrawer();

    expect(screen.getByRole("dialog", { name: "Version history" })).toBeVisible();
  });

  it("Historical versions exist: the available versions are listed with number and date", async () => {
    renderDrawer();

    expect(await screen.findByRole("button", { name: "Version 1 — 2026-01-01" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Version 2 — 2026-01-02" })).toBeVisible();
  });

  it("User selects a version: the historical title and content are displayed read-only", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Version 1 — 2026-01-01" }));

    expect(await screen.findByText("Note 1 (draft)")).toBeVisible();
  });

  it("User previews a version: the current note is not restored", async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    renderDrawer({ onRestored });

    await user.click(await screen.findByRole("button", { name: "Version 1 — 2026-01-01" }));
    await screen.findByText("Note 1 (draft)");

    expect(onRestored).not.toHaveBeenCalled();
  });

  it("User selects an available version for restoration: a restore action naming the version is available", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Version 2 — 2026-01-02" }));

    expect(await screen.findByRole("button", { name: "Restore version 2" })).toBeVisible();
  });

  it("Restore succeeds: the current note reflects the restored content and the drawer closes", async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    const onClose = vi.fn();
    renderDrawer({ onRestored, onClose });

    await user.click(await screen.findByRole("button", { name: "Version 2 — 2026-01-02" }));
    await user.click(await screen.findByRole("button", { name: "Restore version 2" }));

    await vi.waitFor(() => {
      expect(onRestored).toHaveBeenCalledWith(
        expect.objectContaining({ id: EDITABLE_NOTE_ID, title: "Note 1" }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Restore fails: the user receives visible error feedback", async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    const onClose = vi.fn();
    renderDrawer({ onRestored, onClose });

    await user.click(await screen.findByRole("button", { name: "Version 3 — 2026-01-03" }));
    await user.click(await screen.findByRole("button", { name: "Restore version 3" }));

    expect(
      await screen.findByText("Something went wrong while restoring this version."),
    ).toBeVisible();
    expect(onRestored).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
