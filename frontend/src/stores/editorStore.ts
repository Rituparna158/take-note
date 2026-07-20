import { create } from "zustand";

export type AutosaveStatus = "idle" | "saving" | "saved" | "retrying" | "error";

type EditorState = {
  status: AutosaveStatus;
  retryCount: number;
  setSaving: () => void;
  setSaved: () => void;
  setRetrying: (retryCount: number) => void;
  setError: () => void;
  reset: () => void;
};

export const useEditorStore = create<EditorState>()((set) => ({
  status: "idle",
  retryCount: 0,
  setSaving: () => set({ status: "saving", retryCount: 0 }),
  setSaved: () => set({ status: "saved", retryCount: 0 }),
  setRetrying: (retryCount) => set({ status: "retrying", retryCount }),
  setError: () => set({ status: "error" }),
  reset: () => set({ status: "idle", retryCount: 0 }),
}));
