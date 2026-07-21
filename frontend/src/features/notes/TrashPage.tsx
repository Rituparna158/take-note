import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useRestoreNoteMutation } from "./useRestoreNoteMutation.js";
import { useTrashNotesQuery } from "./useTrashNotesQuery.js";

export function TrashPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trashQuery = useTrashNotesQuery();
  const restoreNoteMutation = useRestoreNoteMutation();

  function handleRestore(id: string): void {
    restoreNoteMutation.mutate(id, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <main className="mx-auto max-w-3xl space-y-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Back to Notes
            </button>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Trash Bin (Deleted Notes)
            </h1>
            <p className="text-xs text-slate-500">
              Notes here are preserved for 30 days before permanent auto-purge.
            </p>
          </div>
        </div>

        {trashQuery.isLoading ? (
          <p role="status" className="text-center text-sm text-slate-500">
            Loading deleted notes…
          </p>
        ) : trashQuery.isError ? (
          <div role="alert" className="space-y-3 text-center text-sm text-red-600">
            <p>Something went wrong while loading trash bin.</p>
            <button
              type="button"
              onClick={() => void trashQuery.refetch()}
              className="rounded border border-red-300 px-3 py-1 text-red-700"
            >
              Retry
            </button>
          </div>
        ) : trashQuery.data && trashQuery.data.data.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-base font-medium text-slate-700">Trash Bin is Empty</p>
            <p className="mt-1 text-sm text-slate-500">No soft-deleted notes found.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              Go to Notes
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {trashQuery.data?.data.map((note) => (
              <li
                key={note.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <h2 className="font-semibold text-slate-900">{note.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Deleted on {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(note.id)}
                  disabled={restoreNoteMutation.isPending}
                  className="rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {restoreNoteMutation.isPending ? "Restoring..." : "Restore Note"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
