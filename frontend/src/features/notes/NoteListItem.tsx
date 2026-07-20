import type { ReactElement } from "react";
import type { NoteResponse } from "@take-note/shared";

type NoteListItemProps = {
  note: NoteResponse;
};

export function NoteListItem({ note }: NoteListItemProps): ReactElement {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">{note.title}</h2>
      {note.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <li
              key={tag.id}
              className="rounded-full px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Created {new Date(note.createdAt).toLocaleString()} · Updated{" "}
        {new Date(note.updatedAt).toLocaleString()}
      </p>
    </li>
  );
}
