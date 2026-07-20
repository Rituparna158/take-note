import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "../features/auth/authApi.js";
import { useAuthStore } from "../stores/authStore.js";

export function NotesListHeader(): ReactElement {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-slate-900">Take Note</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">{user?.email}</span>
        <button
          type="button"
          onClick={() => navigate("/notes/new")}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          New Note
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
