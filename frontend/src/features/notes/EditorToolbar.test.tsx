import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";

import { EditorToolbar } from "./EditorToolbar.js";

function mockEditor(): { editor: Editor; chainSpy: ReturnType<typeof vi.fn> } {
  const chainMock = {
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleStrike: vi.fn().mockReturnThis(),
    toggleCode: vi.fn().mockReturnThis(),
    toggleHeading: vi.fn().mockReturnThis(),
    toggleBulletList: vi.fn().mockReturnThis(),
    toggleOrderedList: vi.fn().mockReturnThis(),
    toggleBlockquote: vi.fn().mockReturnThis(),
    toggleCodeBlock: vi.fn().mockReturnThis(),
    undo: vi.fn().mockReturnThis(),
    redo: vi.fn().mockReturnThis(),
    run: vi.fn(),
  };

  const canMock = {
    undo: vi.fn().mockReturnValue(true),
    redo: vi.fn().mockReturnValue(true),
  };

  const chainSpy = vi.fn().mockReturnValue(chainMock);

  const editor = {
    chain: chainSpy,
    can: vi.fn().mockReturnValue(canMock),
    isActive: vi.fn().mockReturnValue(false),
  } as unknown as Editor;

  return { editor, chainSpy };
}

describe("EditorToolbar", () => {
  it("renders null when editor is null", () => {
    const { container } = render(<EditorToolbar editor={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders formatting action buttons and handles bold click", async () => {
    const { editor, chainSpy } = mockEditor();
    const user = userEvent.setup();

    render(<EditorToolbar editor={editor} />);

    const boldButton = screen.getByRole("button", { name: "Bold" });
    expect(boldButton).toBeInTheDocument();

    await user.click(boldButton);

    expect(chainSpy).toHaveBeenCalled();
  });

  it("handles italic and heading button clicks", async () => {
    const { editor, chainSpy } = mockEditor();
    const user = userEvent.setup();

    render(<EditorToolbar editor={editor} />);

    const italicButton = screen.getByRole("button", { name: "Italic" });
    await user.click(italicButton);
    expect(chainSpy).toHaveBeenCalled();

    const h1Button = screen.getByRole("button", { name: "Heading 1" });
    await user.click(h1Button);
    expect(chainSpy).toHaveBeenCalled();
  });
});
