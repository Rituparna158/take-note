import { useState, type ReactElement } from "react";

import { NotesListHeader } from "../../components/NotesListHeader.js";
import { useTagsQuery } from "../tags/useTagsQuery.js";
import { EmptyState } from "./EmptyState.js";
import { NoteListItem } from "./NoteListItem.js";
import { PaginationControls } from "./PaginationControls.js";
import { SortControls, type SortBy, type SortOrder } from "./SortControls.js";
import { TagFilterControls } from "./TagFilterControls.js";
import { useNotesQuery } from "./useNotesQuery.js";

const PAGE_SIZE = 10;

export function NotesListPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const notesQuery = useNotesQuery({
    page,
    limit: PAGE_SIZE,
    sortBy,
    sortOrder,
    tags: selectedTagIds,
  });
  const tagsQuery = useTagsQuery();

  function handleSortByChange(nextSortBy: SortBy): void {
    setSortBy(nextSortBy);
    setPage(1);
  }

  function handleSortOrderChange(nextSortOrder: SortOrder): void {
    setSortOrder(nextSortOrder);
    setPage(1);
  }

  function handleToggleTag(tagId: string): void {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
    setPage(1);
  }

  const isLoading = notesQuery.isLoading || tagsQuery.isLoading;
  const isError = notesQuery.isError || tagsQuery.isError;
  const isUpdating = notesQuery.isFetching && !notesQuery.isLoading;

  function handleRetry(): void {
    void notesQuery.refetch();
    void tagsQuery.refetch();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NotesListHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {isLoading ? (
          <p role="status" className="text-center text-sm text-slate-500">
            Loading your notes…
          </p>
        ) : isError ? (
          <div role="alert" className="space-y-3 text-center text-sm text-red-600">
            <p>Something went wrong while loading your notes.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded border border-red-300 px-3 py-1 text-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {isUpdating && (
              <p role="status" className="text-center text-xs text-slate-400">
                Updating…
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <SortControls
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortByChange={handleSortByChange}
                onSortOrderChange={handleSortOrderChange}
              />
              <TagFilterControls
                tags={tagsQuery.data ?? []}
                selectedTagIds={selectedTagIds}
                onToggleTag={handleToggleTag}
              />
            </div>
            {notesQuery.data && notesQuery.data.data.length === 0 ? (
              <EmptyState isFiltered={selectedTagIds.length > 0} />
            ) : (
              <ul className="space-y-3">
                {notesQuery.data?.data.map((note) => (
                  <NoteListItem key={note.id} note={note} />
                ))}
              </ul>
            )}
            {notesQuery.data && (
              <PaginationControls meta={notesQuery.data.meta} onPageChange={setPage} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
