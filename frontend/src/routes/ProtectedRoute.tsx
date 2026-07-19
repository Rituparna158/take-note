import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore.js";

type ProtectedRouteProps = {
  children: ReactElement;
};

export function ProtectedRoute({ children }: ProtectedRouteProps): ReactElement {
  const status = useAuthStore((state) => state.status);

  if (status === "restoring" || status === "idle") {
    return <p role="status">Loading…</p>;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
