import { useEffect, useRef } from "react";
import type { TiptapDocument } from "@take-note/shared";

import { useEditorStore } from "../../stores/editorStore.js";

const DEBOUNCE_MS = 2000;
const RETRY_BACKOFFS_MS = [1000, 2000, 4000];

export type AutosaveValue = {
  title: string;
  content: TiptapDocument;
  tagIds: string[];
};

type UseAutosaveOptions = {
  enabled: boolean;
  value: AutosaveValue;
  /** The value already known to be persisted (e.g. what a create/load request actually sent/returned), used to seed the baseline so drift since that request is still caught and saved. */
  initialSnapshot: AutosaveValue;
  onSave: (value: AutosaveValue) => Promise<unknown>;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useAutosave({ enabled, value, initialSnapshot, onSave }: UseAutosaveOptions): void {
  const setSaving = useEditorStore((state) => state.setSaving);
  const setSaved = useEditorStore((state) => state.setSaved);
  const setRetrying = useEditorStore((state) => state.setRetrying);
  const setError = useEditorStore((state) => state.setError);

  const lastSavedSnapshotRef = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const snapshot = JSON.stringify(value);
  const initialSnapshotString = JSON.stringify(initialSnapshot);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (lastSavedSnapshotRef.current === null) {
      lastSavedSnapshotRef.current = initialSnapshotString;
    }

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    let cancelled = false;

    async function attemptSave(pendingSnapshot: string): Promise<void> {
      setSaving();
      for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
        if (cancelled) {
          return;
        }
        try {
          await onSaveRef.current(JSON.parse(pendingSnapshot) as AutosaveValue);
          if (cancelled) {
            return;
          }
          lastSavedSnapshotRef.current = pendingSnapshot;
          setSaved();
          return;
        } catch {
          if (attempt === RETRY_BACKOFFS_MS.length) {
            if (!cancelled) {
              setError();
            }
            return;
          }
          setRetrying(attempt + 1);
          await wait(RETRY_BACKOFFS_MS[attempt] as number);
        }
      }
    }

    const timeoutId = setTimeout(() => {
      void attemptSave(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, snapshot, initialSnapshotString, setSaving, setSaved, setRetrying, setError]);
}
