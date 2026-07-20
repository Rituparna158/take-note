import type { ReactElement } from "react";
import type { TagWithCountResponse } from "@take-note/shared";

type TagFilterControlsProps = {
  tags: TagWithCountResponse[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
};

export function TagFilterControls({
  tags,
  selectedTagIds,
  onToggleTag,
}: TagFilterControlsProps): ReactElement {
  if (tags.length === 0) {
    return <></>;
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="sr-only">Filter by tag</legend>
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
