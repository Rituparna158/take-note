import { useEffect, useState, type ReactElement } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { RestoreVersionResponse } from "@take-note/shared";

import { ApiError } from "../../lib/apiClient.js";
import { PasteSanitizeExtension } from "./pasteSanitizeExtension.js";
import { useNoteVersionQuery } from "./useNoteVersionQuery.js";
import { useNoteVersionsQuery } from "./useNoteVersionsQuery.js";
import { useRestoreVersionMutation } from "./useRestoreVersionMutation.js";

type VersionHistoryDrawerProps = {
  noteId: string;
  open: boolean;
  onClose: () => void;
  onRestored: (result: RestoreVersionResponse) => void;
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function VersionHistoryDrawer({
  noteId,
  open,
  onClose,
  onRestored,
}: VersionHistoryDrawerProps): ReactElement {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const versionsQuery = useNoteVersionsQuery(noteId, { enabled: open });
  const versionQuery = useNoteVersionQuery(noteId, open ? selectedVersionId : null);
  const restoreMutation = useRestoreVersionMutation(noteId);

  const previewEditor = useEditor({
    editable: false,
    extensions: [StarterKit, PasteSanitizeExtension],
    content: { type: "doc", content: [] },
  });

  useEffect(() => {
    if (versionQuery.data && previewEditor) {
      previewEditor.commands.setContent(versionQuery.data.content, { emitUpdate: false });
    }
  }, [versionQuery.data, previewEditor]);

  if (!open) {
    return <></>;
  }

  function handleClose(): void {
    setSelectedVersionId(null);
    setRestoreError(null);
    onClose();
  }

  function handleRestore(): void {
    if (selectedVersionId === null) {
      return;
    }
    restoreMutation.mutate(selectedVersionId, {
      onSuccess: (result) => {
        onRestored(result);
        handleClose();
      },
      onError: (error) => {
        setRestoreError(
          toErrorMessage(error, "Something went wrong while restoring this version."),
        );
      },
    });
  }

  return (
    <div className="fixed inset-0 z-10">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {versionsQuery.isLoading && (
          <p role="status" className="text-sm text-slate-500">
            Loading versions…
          </p>
        )}

        {versionsQuery.isError && (
          <p role="alert" className="text-sm text-red-600">
            Something went wrong while loading version history.
          </p>
        )}

        {versionsQuery.data && versionsQuery.data.length === 0 && (
          <p className="text-sm text-slate-500">No historical versions yet.</p>
        )}

        {versionsQuery.data && versionsQuery.data.length > 0 && (
          <ul className="space-y-1">
            {versionsQuery.data.map((version) => (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setSelectedVersionId(version.id)}
                  aria-pressed={version.id === selectedVersionId}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    version.id === selectedVersionId
                      ? "border-slate-900 bg-slate-100"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  Version {version.version} — {formatDate(version.savedAt)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedVersionId !== null && versionQuery.isLoading && (
          <p role="status" className="text-sm text-slate-500">
            Loading version…
          </p>
        )}

        {selectedVersionId !== null && versionQuery.isError && (
          <p role="alert" className="text-sm text-red-600">
            Something went wrong while loading this version.
          </p>
        )}

        {selectedVersionId !== null && versionQuery.data && (
          <div className="space-y-3 rounded border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">{versionQuery.data.title}</p>
            <EditorContent editor={previewEditor} />
            <button
              type="button"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Restore version {versionQuery.data.version}
            </button>
          </div>
        )}

        {restoreError && (
          <p role="alert" className="text-xs text-red-600">
            {restoreError}
          </p>
        )}
      </div>
    </div>
  );
}
