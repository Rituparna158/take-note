import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import type { NoteSearchResult } from "@take-note/shared";

type SearchResultItemProps = {
  result: NoteSearchResult;
};

export function SearchResultItem({ result }: SearchResultItemProps): ReactElement {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <Link to={`/notes/${result.id}`} className="block">
        <h2 className="font-medium text-slate-900">{result.title}</h2>
        <p
          className="mt-2 text-sm text-slate-600"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.highlight) }}
        />
      </Link>
    </li>
  );
}
