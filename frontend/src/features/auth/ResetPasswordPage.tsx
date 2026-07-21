import { useState, type FormEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { resetPasswordRequestSchema } from "@take-note/shared";

import { resetPassword } from "./authApi.js";

export function ResetPasswordPage(): ReactElement {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const result = resetPasswordRequestSchema.safeParse({ email, otp, newPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const response = await resetPassword(result.data);
      setSuccessMessage(response.message);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        {successMessage ? (
          <>
            <p role="status" className="text-sm text-emerald-700">
              {successMessage}
            </p>
            <p className="text-sm text-slate-600">
              <Link to="/login">Log in</Link>
            </p>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="reset-otp" className="block text-sm font-medium text-slate-700">
                6-digit code
              </label>
              <input
                id="reset-otp"
                name="otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
              {fieldErrors.otp && <p className="mt-1 text-sm text-red-600">{fieldErrors.otp}</p>}
            </div>

            <div>
              <label
                htmlFor="reset-new-password"
                className="block text-sm font-medium text-slate-700"
              >
                New password
              </label>
              <input
                id="reset-new-password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
              {fieldErrors.newPassword && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.newPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSubmitting ? "Resetting…" : "Reset password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
