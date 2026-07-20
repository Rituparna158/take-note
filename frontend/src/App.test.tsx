import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App.js";
import { useAuthStore } from "./stores/authStore.js";
import { createTestQueryClient } from "./test/createTestQueryClient.js";
import { server } from "./test/mocks/server.js";

beforeEach(() => {
  window.history.pushState({}, "", "/");
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

function renderApp() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App session bootstrap", () => {
  it("A valid refresh session is restored on reload", async () => {
    renderApp();

    expect(await screen.findByText("user@example.com")).toBeVisible();
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("A missing or invalid refresh session is not restored", async () => {
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { code: "UNAUTHORIZED", message: "Missing refresh token" },
          { status: 401 },
        ),
      ),
    );

    renderApp();

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeVisible();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
});
