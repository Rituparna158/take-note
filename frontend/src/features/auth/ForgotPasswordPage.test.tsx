import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ForgotPasswordPage } from "./ForgotPasswordPage.js";

describe("ForgotPasswordPage", () => {
  it("Forgot-password flow is available", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toBeVisible();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If this email is registered, a password reset code has been generated.",
    );
  });
});
