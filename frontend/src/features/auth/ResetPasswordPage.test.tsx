import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { VALID_OTP } from "../../test/mocks/handlers.js";
import { ResetPasswordPage } from "./ResetPasswordPage.js";

function renderResetPasswordPage() {
  render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  it("OTP and new-password input capability is available", () => {
    renderResetPasswordPage();

    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();
    expect(screen.getByLabelText("6-digit code")).toBeVisible();
    expect(screen.getByLabelText("New password")).toBeVisible();
  });

  it("Reset-password failure shows visible error feedback", async () => {
    const user = userEvent.setup();
    renderResetPasswordPage();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("6-digit code"), "000000");
    await user.type(screen.getByLabelText("New password"), "12345678");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired code");
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });

  it("Successful reset allows login with the new password", async () => {
    const user = userEvent.setup();
    renderResetPasswordPage();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("6-digit code"), VALID_OTP);
    await user.type(screen.getByLabelText("New password"), "newpassword123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Password reset successful");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });
});
