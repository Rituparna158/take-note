import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "../../test/createTestQueryClient.js";
import { TAG_PERSONAL_ID, TAG_WORK_ID } from "../../test/mocks/handlers.js";
import { server } from "../../test/mocks/server.js";
import { TagPicker } from "./TagPicker.js";

const TAGS = [
  { id: TAG_WORK_ID, name: "Work", color: "#ff0000", _count: { notes: 2 } },
  { id: TAG_PERSONAL_ID, name: "Personal", color: "#00ff00", _count: { notes: 2 } },
];

function renderTagPicker(
  selectedTagIds: string[] = [],
  onToggleTag: (tagId: string) => void = vi.fn(),
): RenderResult {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TagPicker tags={TAGS} selectedTagIds={selectedTagIds} onToggleTag={onToggleTag} />
    </QueryClientProvider>,
  );
}

describe("TagPicker", () => {
  it("renders a pill for each existing tag reflecting its selected state", () => {
    renderTagPicker([TAG_WORK_ID]);

    expect(screen.getByRole("checkbox", { name: "Work" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Personal" })).not.toBeChecked();
  });

  it("toggling a tag pill invokes onToggleTag with that tag's id", async () => {
    const user = userEvent.setup();
    const onToggleTag = vi.fn();
    renderTagPicker([], onToggleTag);

    await user.click(screen.getByRole("checkbox", { name: "Personal" }));

    expect(onToggleTag).toHaveBeenCalledWith(TAG_PERSONAL_ID);
  });

  it("creating a new tag via + Add Tag posts it and selects it", async () => {
    const user = userEvent.setup();
    const onToggleTag = vi.fn();
    const NEW_TAG_ID = "20000000-0000-4000-8000-000000000099";
    server.use(
      http.post("/api/tags", async ({ request }) => {
        const body = (await request.json()) as { name: string; color: string };
        return HttpResponse.json(
          { id: NEW_TAG_ID, name: body.name, color: body.color },
          { status: 201 },
        );
      }),
    );

    renderTagPicker([], onToggleTag);

    await user.click(screen.getByRole("button", { name: "+ Add Tag" }));
    await user.type(screen.getByPlaceholderText("Tag name..."), "Ideas");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onToggleTag).toHaveBeenCalledWith(NEW_TAG_ID);
    });
    expect(screen.queryByPlaceholderText("Tag name...")).not.toBeInTheDocument();
  });

  it("does not create a tag when the name is blank", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      http.post("/api/tags", () => {
        postCount += 1;
        return HttpResponse.json({ id: "x", name: "", color: "#000" });
      }),
    );

    renderTagPicker();

    await user.click(screen.getByRole("button", { name: "+ Add Tag" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(postCount).toBe(0);
  });
});
