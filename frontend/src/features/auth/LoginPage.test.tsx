import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useAuthStore } from "../../stores/authStore.js";
import { REGISTERED_EMAIL, REGISTERED_PASSWORD } from "../../test/mocks/handlers.js";
import { LoginPage } from "./LoginPage.js";

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Authenticated home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

describe("LoginPage", () => {
  it("Login form is available", () => {
    renderLoginPage();

    expect(screen.getByRole("heading", { name: "Log in" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeVisible();
  });

  it("Successful login grants access to authenticated functionality", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), REGISTERED_EMAIL);
    await user.type(screen.getByLabelText("Password"), REGISTERED_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByText("Authenticated home")).toBeVisible();
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user?.email).toBe(REGISTERED_EMAIL);
  });

  it("Login failure shows visible error feedback", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), REGISTERED_EMAIL);
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeVisible();
  });
});
