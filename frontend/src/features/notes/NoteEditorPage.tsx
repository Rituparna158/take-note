import { useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { RestoreVersionResponse, TiptapDocument } from "@take-note/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useTagsQuery } from "../tags/useTagsQuery.js";
import { useEditorStore } from "../../stores/editorStore.js";
import { useNoteStore } from "../../stores/noteStore.js";
import { PasteSanitizeExtension } from "./pasteSanitizeExtension.js";
import { ShareModal } from "./ShareModal.js";
import { TagPicker } from "./TagPicker.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { useAutosave, type AutosaveValue } from "./useAutosave.js";
import { useCreateNoteMutation } from "./useCreateNoteMutation.js";
import { useDeleteNoteMutation } from "./useDeleteNoteMutation.js";
import { useNoteQuery } from "./useNoteQuery.js";
import { useUpdateNoteMutation } from "./useUpdateNoteMutation.js";
import { VersionHistoryDrawer } from "./VersionHistoryDrawer.js";

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
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const hasFiredCreateRef = useRef(false);
  const creationPromiseRef = useRef<Promise<string | null> | null>(null);
  const latestValuesRef = useRef<AutosaveValue>({ title, content, tagIds });
  useEffect(() => {
    latestValuesRef.current = { title, content, tagIds };
  });

  // While a new note's background creation POST is still in flight, noteId is null.
  // Actions fired in that window (Back to Notes, tag toggle, title blur) must wait for
  // creation to resolve instead of silently no-op'ing, or the typed data is lost forever.
  async function ensureNoteId(): Promise<string | null> {
    if (noteId !== null) {
      return noteId;
    }
    return creationPromiseRef.current;
  }

  const editor = useEditor({
    extensions: [StarterKit, PasteSanitizeExtension],
    onUpdate: ({ editor: updatedEditor }) => {
      setContent(updatedEditor.getJSON() as TiptapDocument);
    },
  });

  const queryClient = useQueryClient();
  const createNoteMutation = useCreateNoteMutation();
  const updateNoteMutation = useUpdateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
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
    const nextTagIds = tagIds.includes(tagId)
      ? tagIds.filter((id) => id !== tagId)
      : [...tagIds, tagId];
    setTagIds(nextTagIds);
    void (async () => {
      const resolvedNoteId = await ensureNoteId();
      if (resolvedNoteId !== null) {
        updateNoteMutation.mutate({
          id: resolvedNoteId,
          payload: {
            title: latestValuesRef.current.title,
            content: latestValuesRef.current.content,
            tagIds: nextTagIds,
          },
        });
      }
    })();
  }

  function handleRestored(result: RestoreVersionResponse): void {
    const restoredSnapshot = { title: result.title, content: result.content, tagIds };
    setTitle(result.title);
    setContent(result.content);
    editor?.commands.setContent(result.content, { emitUpdate: false });
    setPersistedSnapshot(restoredSnapshot);
    markSaved(restoredSnapshot);
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

  const { markSaved } = useAutosave({
    enabled: createdLocally || (noteId !== null && appliedNoteId === noteId),
    value: { title, content, tagIds },
    initialSnapshot: persistedSnapshot ?? { title, content, tagIds },
    onSave: (value) => {
      if (!noteId) {
        return Promise.resolve();
      }
      return updateNoteMutation.mutateAsync({
        id: noteId,
        payload: {
          title: value.title,
          content: value.content,
          tagIds: value.tagIds,
        },
      });
    },
  });

  function fireCreateNote(): void {
    if (!editor) {
      return;
    }
    const currentTitle = title.trim() || "Untitled";
    const currentContent = editor.getJSON() as TiptapDocument;
    creationPromiseRef.current = createNoteMutation
      .mutateAsync({ title: currentTitle, content: currentContent })
      .then((note) => {
        const snapshot = { title: currentTitle, content: currentContent, tagIds: [] };
        setCreatedLocally(true);
        setAppliedNoteId(note.id);
        setPersistedSnapshot(snapshot);
        setNoteId(note.id);

        queryClient.setQueryData(["notes", note.id], {
          ...note,
          title: currentTitle,
          content: currentContent,
          tags: [],
        });
        void queryClient.invalidateQueries({ queryKey: ["notes"] });

        navigate(`/notes/${note.id}`, { replace: true });
        return note.id;
      })
      .catch(() => {
        setCreationFailed(true);
        return null;
      });
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

  async function handleBackToNotes(): Promise<void> {
    const resolvedNoteId = await ensureNoteId();
    if (resolvedNoteId !== null) {
      const latest = latestValuesRef.current;
      const finalTitle = latest.title.trim() || "Untitled";
      await updateNoteMutation.mutateAsync({
        id: resolvedNoteId,
        payload: {
          title: finalTitle,
          content: latest.content,
          tagIds: latest.tagIds,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    }
    navigate("/");
  }

  async function handleManualSave(): Promise<void> {
    if (noteId === null) {
      return;
    }
    const finalTitle = title.trim() || "Untitled";
    await updateNoteMutation.mutateAsync({
      id: noteId,
      payload: {
        title: finalTitle,
        content,
        tagIds,
      },
    });
    markSaved({ title: finalTitle, content, tagIds });
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8">
      <main className="mx-auto max-w-3xl px-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void handleBackToNotes()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Back to Notes
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                void (async () => {
                  const resolvedNoteId = await ensureNoteId();
                  if (resolvedNoteId !== null) {
                    const latest = latestValuesRef.current;
                    updateNoteMutation.mutate({
                      id: resolvedNoteId,
                      payload: {
                        title: latest.title.trim() || "Untitled",
                        content: latest.content,
                        tagIds: latest.tagIds,
                      },
                    });
                  }
                })();
              }}
              aria-label="Note title"
              placeholder="Note title..."
              className="w-full border-b border-slate-200 bg-transparent py-1 text-3xl font-bold tracking-tight text-slate-900 focus:border-slate-900 focus:outline-none placeholder:text-slate-400"
            />
            {noteId !== null && (
              <button
                type="button"
                onClick={() => void handleManualSave()}
                disabled={updateNoteMutation.isPending}
                className="shrink-0 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {updateNoteMutation.isPending ? "Saving..." : "Save Note"}
              </button>
            )}
            {noteId !== null && (
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Share
              </button>
            )}
            {noteId !== null && (
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(true)}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                History
              </button>
            )}
            {noteId !== null && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this note? It will be moved to soft-delete recovery.",
                    )
                  ) {
                    deleteNoteMutation.mutate(noteId, {
                      onSuccess: () => navigate("/"),
                    });
                  }
                }}
                disabled={deleteNoteMutation.isPending}
                className="shrink-0 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                {deleteNoteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>

          <TagPicker
            tags={tagsQuery.data ?? []}
            selectedTagIds={tagIds}
            onToggleTag={handleToggleTag}
          />

          <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <EditorToolbar editor={editor} />
            <div className="p-4 min-h-[300px] prose prose-slate max-w-none focus:outline-none">
              <EditorContent editor={editor} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              {autosaveStatus === "saved" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  Saved
                </span>
              )}
              {autosaveStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  Saving...
                </span>
              )}
              {autosaveStatus === "retrying" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                  Retrying save… (attempt {autosaveRetryCount}/3)
                </span>
              )}
              {autosaveStatus === "error" && (
                <span role="alert" className="text-xs font-medium text-red-600">
                  Your latest changes could not be saved. Please check your connection and try
                  again.
                </span>
              )}
            </div>
          </div>
        </div>

        {noteId !== null && (
          <ShareModal
            noteId={noteId}
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
          />
        )}
        {noteId !== null && (
          <VersionHistoryDrawer
            noteId={noteId}
            open={historyDrawerOpen}
            onClose={() => setHistoryDrawerOpen(false)}
            onRestored={handleRestored}
          />
        )}
      </main>
    </div>
  );
}
