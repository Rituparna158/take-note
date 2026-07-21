import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import type { NoteResponse } from "@take-note/shared";

type NoteListItemProps = {
  note: NoteResponse;
  onDelete?: (id: string) => void;
};

export function NoteListItem({ note, onDelete }: NoteListItemProps): ReactElement {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/notes/${note.id}`} className="block flex-1">
          <h2 className="font-semibold text-slate-900 hover:text-slate-700">{note.title}</h2>
          {note.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <li
                  key={tag.id}
                  className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white shadow-sm"
                >
                  #{tag.name}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Created {new Date(note.createdAt).toLocaleString()} · Updated{" "}
            {new Date(note.updatedAt).toLocaleString()}
          </p>
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 transition-colors p-1"
            title={`Delete note ${note.title}`}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
