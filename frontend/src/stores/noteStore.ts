import { create } from "zustand";

type NoteState = {
  openNoteId: string | null;
  setOpenNoteId: (noteId: string) => void;
  clearOpenNoteId: () => void;
};

export const useNoteStore = create<NoteState>()((set) => ({
  openNoteId: null,
  setOpenNoteId: (noteId) => set({ openNoteId: noteId }),
  clearOpenNoteId: () => set({ openNoteId: null }),
}));
