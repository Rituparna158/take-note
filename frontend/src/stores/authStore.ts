import { create } from "zustand";
import type { AuthUser } from "@take-note/shared";

export type AuthStatus = "idle" | "restoring" | "authenticated" | "unauthenticated";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  setRestoring: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) => set({ accessToken, user, status: "authenticated" }),
  clearSession: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
  setRestoring: () => set({ status: "restoring" }),
}));
