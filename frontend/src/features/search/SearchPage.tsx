import { useState, type FormEvent, type ReactElement } from "react";

import { NotesListHeader } from "../../components/NotesListHeader.js";
import { PaginationControls } from "../notes/PaginationControls.js";
import { SearchIdleState } from "./SearchIdleState.js";
import { SearchResultItem } from "./SearchResultItem.js";
import { useSearchQuery } from "./useSearchQuery.js";

const PAGE_SIZE = 10;

export function SearchPage(): ReactElement {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);

  const searchQuery = useSearchQuery({
    q: submittedQuery,
    page,
    limit: PAGE_SIZE,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) {
      return;
    }
    setSubmittedQuery(trimmed);
    setPage(1);
  }

  function handleRetry(): void {
    void searchQuery.refetch();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NotesListHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Search your notes…"
            aria-label="Search your notes"
            className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            Search
          </button>
        </form>

        {submittedQuery === "" ? (
          <SearchIdleState />
        ) : searchQuery.isLoading ? (
          <p role="status" className="text-center text-sm text-slate-500">
            Searching your notes…
          </p>
        ) : searchQuery.isError ? (
          <div role="alert" className="space-y-3 text-center text-sm text-red-600">
            <p>Something went wrong while searching your notes.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded border border-red-300 px-3 py-1 text-red-700"
            >
              Retry
            </button>
          </div>
        ) : searchQuery.data && searchQuery.data.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No notes match your search.
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {searchQuery.data?.data.map((result) => (
                <SearchResultItem key={result.id} result={result} />
              ))}
            </ul>
            {searchQuery.data && (
              <PaginationControls meta={searchQuery.data.meta} onPageChange={setPage} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
