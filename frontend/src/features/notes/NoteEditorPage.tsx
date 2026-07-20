import { useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { TiptapDocument } from "@take-note/shared";

import { useTagsQuery } from "../tags/useTagsQuery.js";
import { useEditorStore } from "../../stores/editorStore.js";
import { useNoteStore } from "../../stores/noteStore.js";
import { PasteSanitizeExtension } from "./pasteSanitizeExtension.js";
import { ShareModal } from "./ShareModal.js";
import { TagPicker } from "./TagPicker.js";
import { useAutosave, type AutosaveValue } from "./useAutosave.js";
import { useCreateNoteMutation } from "./useCreateNoteMutation.js";
import { useNoteQuery } from "./useNoteQuery.js";
import { useUpdateNoteMutation } from "./useUpdateNoteMutation.js";

export function NoteEditorPage(): ReactElement {
  const { id: routeId } = useParams<{ id?: string }>();
  const isNew = routeId === undefined;
  const navigate = useNavigate();

  const [noteId, setNoteId] = useState<string | null>(isNew ? null : (routeId ?? null));
  const [creationFailed, setCreationFailed] = useState(false);
  const [title, setTitle] = useState("Untitled");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [content, setContent] = useState<TiptapDocument>({ type: "doc", content: [] });
  const [appliedNoteId, setAppliedNoteId] = useState<string | null>(null);
  const [createdLocally, setCreatedLocally] = useState(false);
  const [persistedSnapshot, setPersistedSnapshot] = useState<AutosaveValue | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const hasFiredCreateRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit, PasteSanitizeExtension],
    onUpdate: ({ editor: updatedEditor }) => {
      setContent(updatedEditor.getJSON() as TiptapDocument);
    },
  });

  const createNoteMutation = useCreateNoteMutation();
  const updateNoteMutation = useUpdateNoteMutation(noteId ?? "");
  const noteQuery = useNoteQuery(routeId ?? "");
  const tagsQuery = useTagsQuery();
  const autosaveStatus = useEditorStore((state) => state.status);
  const autosaveRetryCount = useEditorStore((state) => state.retryCount);
  const setOpenNoteId = useNoteStore((state) => state.setOpenNoteId);
  const clearOpenNoteId = useNoteStore((state) => state.clearOpenNoteId);

  useEffect(() => {
    if (noteId === null) {
      return;
    }
    setOpenNoteId(noteId);
    return () => {
      clearOpenNoteId();
    };
  }, [noteId, setOpenNoteId, clearOpenNoteId]);

  function handleToggleTag(tagId: string): void {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  if (!isNew && !createdLocally && noteQuery.data && noteQuery.data.id !== appliedNoteId) {
    const loadedTagIds = noteQuery.data.tags.map((tag) => tag.id);
    setAppliedNoteId(noteQuery.data.id);
    setTitle(noteQuery.data.title);
    setTagIds(loadedTagIds);
    setContent(noteQuery.data.content);
    setPersistedSnapshot({
      title: noteQuery.data.title,
      content: noteQuery.data.content,
      tagIds: loadedTagIds,
    });
  }

  useEffect(() => {
    if (
      isNew ||
      createdLocally ||
      !editor ||
      !noteQuery.data ||
      noteQuery.data.id !== appliedNoteId
    ) {
      return;
    }
    editor.commands.setContent(noteQuery.data.content, { emitUpdate: false });
  }, [isNew, editor, noteQuery.data, appliedNoteId, createdLocally]);

  useAutosave({
    enabled: createdLocally || (noteId !== null && appliedNoteId === noteId),
    value: { title, content, tagIds },
    initialSnapshot: persistedSnapshot ?? { title, content, tagIds },
    onSave: (value) =>
      updateNoteMutation.mutateAsync({
        title: value.title,
        content: value.content,
        tagIds: value.tagIds,
      }),
  });

  function fireCreateNote(): void {
    if (!editor) {
      return;
    }
    const initialContent = editor.getJSON() as TiptapDocument;
    createNoteMutation.mutate(
      { title: "Untitled", content: initialContent },
      {
        onSuccess: (note) => {
          setCreatedLocally(true);
          setPersistedSnapshot({ title: "Untitled", content: initialContent, tagIds: [] });
          setNoteId(note.id);
          navigate(`/notes/${note.id}`, { replace: true });
        },
        onError: () => {
          setCreationFailed(true);
        },
      },
    );
  }

  function handleRetryCreate(): void {
    setCreationFailed(false);
    fireCreateNote();
  }

  useEffect(() => {
    if (!isNew || !editor || noteId !== null || creationFailed || hasFiredCreateRef.current) {
      return;
    }
    // Guards against React StrictMode's synchronous double-invocation of mount effects in
    // development, which would otherwise fire two POST /api/notes requests before the first
    // mutation's onSuccess has a chance to set noteId.
    hasFiredCreateRef.current = true;
    fireCreateNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, editor, noteId, creationFailed]);

  if (creationFailed) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-3xl space-y-4 px-6 py-8">
          <div role="alert" className="space-y-3 text-center text-sm text-red-600">
            <p>Something went wrong while creating your note.</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleRetryCreate}
                className="rounded border border-red-300 px-3 py-1 text-red-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded border border-slate-300 px-3 py-1 text-slate-700"
              >
                Back to Notes
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isNew && noteQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-3xl space-y-4 px-6 py-8">
          <p role="status" className="text-center text-sm text-slate-500">
            Loading note…
          </p>
        </main>
      </div>
    );
  }

  if (!isNew && noteQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-3xl space-y-4 px-6 py-8">
          <div role="alert" className="space-y-3 text-center text-sm text-red-600">
            <p>Something went wrong while loading this note.</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => void noteQuery.refetch()}
                className="rounded border border-red-300 px-3 py-1 text-red-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded border border-slate-300 px-3 py-1 text-slate-700"
              >
                Back to Notes
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl space-y-4 px-6 py-8">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Note title"
            className="w-full border-b border-slate-300 bg-transparent text-2xl font-semibold text-slate-900 focus:outline-none"
          />
          {noteId !== null && (
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="shrink-0 rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
            >
              Share
            </button>
          )}
        </div>
        <TagPicker
          tags={tagsQuery.data ?? []}
          selectedTagIds={tagIds}
          onToggleTag={handleToggleTag}
        />
        <EditorContent editor={editor} />
        {autosaveStatus === "saved" && <p className="text-xs text-slate-400">Saved</p>}
        {autosaveStatus === "retrying" && (
          <p className="text-xs text-slate-400">Retrying save… (attempt {autosaveRetryCount}/3)</p>
        )}
        {autosaveStatus === "error" && (
          <p role="alert" className="text-xs text-red-600">
            Your latest changes could not be saved. Please check your connection and try again.
          </p>
        )}
        {noteId !== null && (
          <ShareModal
            noteId={noteId}
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
