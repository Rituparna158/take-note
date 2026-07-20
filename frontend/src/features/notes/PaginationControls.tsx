import type { ReactElement } from "react";
import type { NoteListMeta } from "@take-note/shared";

type PaginationControlsProps = {
  meta: NoteListMeta;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ meta, onPageChange }: PaginationControlsProps): ReactElement {
  const { page, totalPages } = meta;

  return (
    <nav className="flex items-center justify-center gap-4" aria-label="Notes pagination">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        Previous page
      </button>
      <span className="text-sm text-slate-600">
        Page {page} of {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        Next page
      </button>
    </nav>
  );
}
