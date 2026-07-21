import { useState, type FormEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordRequestSchema } from "@take-note/shared";

import { forgotPassword } from "./authApi.js";

export function ForgotPasswordPage(): ReactElement {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setConfirmationMessage(null);

    const result = forgotPasswordRequestSchema.safeParse({ email });
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
      const response = await forgotPassword(result.data);
      setConfirmationMessage(response.message);
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
        <h1 className="text-2xl font-semibold text-slate-900">Forgot your password?</h1>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        {confirmationMessage && (
          <p role="status" className="text-sm text-emerald-700">
            {confirmationMessage}
          </p>
        )}

        <div>
          <label
            htmlFor="forgot-password-email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="forgot-password-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Sending…" : "Send reset code"}
        </button>

        <p className="text-sm text-slate-600">
          Already have a code? <Link to="/reset-password">Reset your password</Link>
        </p>
      </form>
    </main>
  );
}
