import { useState, type ReactElement } from "react";
import type { TagWithCountResponse } from "@take-note/shared";
import { useCreateTagMutation } from "../tags/useCreateTagMutation.js";

type TagPickerProps = {
  tags: TagWithCountResponse[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
};

export function TagPicker({ tags, selectedTagIds, onToggleTag }: TagPickerProps): ReactElement {
  const [newTagName, setNewTagName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createTagMutation = useCreateTagMutation();

  function handleCreateTag(): void {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      return;
    }
    createTagMutation.mutate(
      { name: trimmed, color: "#64748b" },
      {
        onSuccess: (newTag) => {
          setNewTagName("");
          setIsCreating(false);
          if (!selectedTagIds.includes(newTag.id)) {
            onToggleTag(newTag.id);
          }
        },
      },
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Tags</legend>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
          Tags:
        </span>
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <label
              key={tag.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-all ${
                isSelected
                  ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleTag(tag.id)}
                className="h-3 w-3 accent-slate-900"
              />
              <span>{tag.name}</span>
            </label>
          );
        })}

        {isCreating ? (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateTag();
                } else if (e.key === "Escape") {
                  setIsCreating(false);
                }
              }}
              placeholder="Tag name..."
              autoFocus
              className="rounded-full border border-slate-300 bg-white px-3 py-0.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={createTagMutation.isPending}
              className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              {createTagMutation.isPending ? "..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-800 transition-colors"
          >
            + Add Tag
          </button>
        )}
      </div>
    </fieldset>
  );
}
