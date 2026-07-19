import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ProtectedRoute } from "../../routes/ProtectedRoute.js";
import { useAuthStore } from "../../stores/authStore.js";
import { AuthenticatedPlaceholderPage } from "./AuthenticatedPlaceholderPage.js";

function renderApp() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AuthenticatedPlaceholderPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

describe("AuthenticatedPlaceholderPage and ProtectedRoute", () => {
  it("Authenticated user can access the placeholder page", () => {
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" },
      status: "authenticated",
    });

    renderApp();

    expect(screen.getByText("Signed in as user@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  it("Unauthenticated user is denied access to the placeholder page", () => {
    useAuthStore.setState({ accessToken: null, user: null, status: "unauthenticated" });

    renderApp();

    expect(screen.getByText("Login page")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("Logout ends the session and returns to login", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      accessToken: "test-access-token",
      user: { id: "550e8400-e29b-41d4-a716-446655440000", email: "user@example.com" },
      status: "authenticated",
    });

    renderApp();

    await user.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeVisible();
    });
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
