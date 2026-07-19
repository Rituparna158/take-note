import { http, HttpResponse } from "msw";
import type { HttpHandler } from "msw";

export const EXISTING_EMAIL = "existing@example.com";
export const REGISTERED_EMAIL = "user@example.com";
export const REGISTERED_PASSWORD = "correct-password";
export const REGISTERED_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const VALID_OTP = "123456";

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeFakeAccessToken(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.test-signature`;
}

export const FAKE_ACCESS_TOKEN = makeFakeAccessToken({
  sub: REGISTERED_USER_ID,
  email: REGISTERED_EMAIL,
});

export const handlers: HttpHandler[] = [
  http.post("/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === EXISTING_EMAIL) {
      return HttpResponse.json(
        { code: "CONFLICT", message: "This email is already registered." },
        { status: 422 },
      );
    }
    return HttpResponse.json(
      {
        accessToken: FAKE_ACCESS_TOKEN,
        user: { id: REGISTERED_USER_ID, email: body.email },
      },
      { status: 201 },
    );
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === REGISTERED_EMAIL && body.password === REGISTERED_PASSWORD) {
      return HttpResponse.json(
        {
          accessToken: FAKE_ACCESS_TOKEN,
          user: { id: REGISTERED_USER_ID, email: body.email },
        },
        { status: 200 },
      );
    }
    return HttpResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid email or password." },
      { status: 401 },
    );
  }),

  http.post("/api/auth/logout", () => {
    return HttpResponse.json({ message: "Logged out successfully" }, { status: 200 });
  }),

  http.post("/api/auth/refresh", () => {
    return HttpResponse.json({ accessToken: FAKE_ACCESS_TOKEN }, { status: 200 });
  }),

  http.post("/api/auth/forgot-password", () => {
    return HttpResponse.json(
      { message: "If this email is registered, a password reset code has been generated." },
      { status: 200 },
    );
  }),

  http.post("/api/auth/reset-password", async ({ request }) => {
    const body = (await request.json()) as { otp: string };
    if (body.otp !== VALID_OTP) {
      return HttpResponse.json(
        { code: "VALIDATION_ERROR", message: "Invalid or expired code." },
        { status: 400 },
      );
    }
    return HttpResponse.json({ message: "Password reset successful" }, { status: 200 });
  }),
];
