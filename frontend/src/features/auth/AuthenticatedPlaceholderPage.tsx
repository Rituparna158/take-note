import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../../stores/authStore.js";
import { logout } from "./authApi.js";

export function AuthenticatedPlaceholderPage(): ReactElement {
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 text-center shadow">
        <h1 className="text-2xl font-semibold text-slate-900">Take Note</h1>
        <p className="text-sm text-slate-600">Signed in as {user?.email}</p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </main>
  );
}
