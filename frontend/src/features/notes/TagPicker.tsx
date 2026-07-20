import type { ReactElement } from "react";
import type { TagWithCountResponse } from "@take-note/shared";

type TagPickerProps = {
  tags: TagWithCountResponse[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
};

export function TagPicker({ tags, selectedTagIds, onToggleTag }: TagPickerProps): ReactElement {
  if (tags.length === 0) {
    return <></>;
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="text-sm font-medium text-slate-700">Tags</legend>
      {tags.map((tag) => (
        <label key={tag.id} className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selectedTagIds.includes(tag.id)}
            onChange={() => onToggleTag(tag.id)}
          />
          {tag.name}
        </label>
      ))}
    </fieldset>
  );
}
