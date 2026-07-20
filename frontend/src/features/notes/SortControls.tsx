import type { ReactElement } from "react";

export type SortBy = "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

type SortControlsProps = {
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortByChange: (sortBy: SortBy) => void;
  onSortOrderChange: (sortOrder: SortOrder) => void;
};

export function SortControls({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: SortControlsProps): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Sort by
        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as SortBy)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="updatedAt">Last updated</option>
          <option value="createdAt">Date created</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Order
        <select
          value={sortOrder}
          onChange={(event) => onSortOrderChange(event.target.value as SortOrder)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </label>
    </div>
  );
}
