import type { ReactElement } from "react";
import type { Editor } from "@tiptap/react";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps): ReactElement | null {
  if (!editor) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Text formatting options"
      className="flex flex-wrap items-center gap-1 rounded-t-xl border border-slate-200 bg-slate-100/80 p-2 text-slate-700 backdrop-blur-sm"
    >
      <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
            editor.isActive("bold")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2.5 py-1 text-xs italic font-semibold transition-colors ${
            editor.isActive("italic")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded px-2.5 py-1 text-xs line-through transition-colors ${
            editor.isActive("strike")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Strikethrough"
          aria-pressed={editor.isActive("strike")}
        >
          S
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
            editor.isActive("code")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Inline Code"
          aria-pressed={editor.isActive("code")}
        >
          {"</>"}
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-slate-300">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
            editor.isActive("heading", { level: 1 })
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Heading 1"
          aria-pressed={editor.isActive("heading", { level: 1 })}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
            editor.isActive("heading", { level: 2 })
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Heading 2"
          aria-pressed={editor.isActive("heading", { level: 2 })}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
            editor.isActive("heading", { level: 3 })
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Heading 3"
          aria-pressed={editor.isActive("heading", { level: 3 })}
        >
          H3
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-slate-300">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            editor.isActive("bulletList")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Bullet List"
          aria-pressed={editor.isActive("bulletList")}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            editor.isActive("orderedList")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Numbered List"
          aria-pressed={editor.isActive("orderedList")}
        >
          1. List
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-slate-300">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            editor.isActive("blockquote")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Blockquote"
          aria-pressed={editor.isActive("blockquote")}
        >
          &quot; Quote
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
            editor.isActive("codeBlock")
              ? "bg-slate-900 text-white shadow-sm"
              : "hover:bg-slate-200 text-slate-700"
          }`}
          aria-label="Code Block"
          aria-pressed={editor.isActive("codeBlock")}
        >
          {"{ } Code"}
        </button>
      </div>

      <div className="flex items-center gap-1 pl-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="rounded px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Undo"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="rounded px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Redo"
        >
          ↷ Redo
        </button>
      </div>
    </div>
  );
}
