import type { ReactElement } from "react";

export function SearchIdleState(): ReactElement {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Enter a keyword and search to find your notes.
    </div>
  );
}
