import type { ReactElement } from "react";

type EmptyStateProps = {
  isFiltered: boolean;
};

export function EmptyState({ isFiltered }: EmptyStateProps): ReactElement {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      {isFiltered ? "No notes match the selected filters." : "You have no notes yet."}
    </div>
  );
}
