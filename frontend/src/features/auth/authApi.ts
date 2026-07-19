import {
  registerRequestSchema,
  loginRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  authResponseSchema,
  refreshResponseSchema,
  messageResponseSchema,
  type RegisterRequest,
  type LoginRequest,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type AuthResponse,
  type MessageResponse,
} from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";
import { decodeAccessToken } from "../../lib/jwt.js";
import { useAuthStore } from "../../stores/authStore.js";

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const body = registerRequestSchema.parse(payload);
  const response = await apiRequest<unknown>({
    method: "POST",
    path: "/api/auth/register",
    body,
  });
  const auth = authResponseSchema.parse(response);
  useAuthStore.getState().setSession(auth.accessToken, auth.user);
  return auth;
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const body = loginRequestSchema.parse(payload);
  const response = await apiRequest<unknown>({
    method: "POST",
    path: "/api/auth/login",
    body,
  });
  const auth = authResponseSchema.parse(response);
  useAuthStore.getState().setSession(auth.accessToken, auth.user);
  return auth;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<unknown>({ method: "POST", path: "/api/auth/logout" });
  } finally {
    useAuthStore.getState().clearSession();
  }
}

/**
 * Silently restores a session on app load. `/api/auth/refresh` returns only an
 * accessToken (no user object), so the user's id/email are read from the token's
 * own claims — see decodeAccessToken.
 */
export async function refresh(): Promise<boolean> {
  useAuthStore.getState().setRestoring();
  try {
    const response = await apiRequest<unknown>({ method: "POST", path: "/api/auth/refresh" });
    const { accessToken } = refreshResponseSchema.parse(response);
    const claims = decodeAccessToken(accessToken);
    if (!claims) {
      useAuthStore.getState().clearSession();
      return false;
    }
    useAuthStore.getState().setSession(accessToken, { id: claims.sub, email: claims.email });
    return true;
  } catch {
    useAuthStore.getState().clearSession();
    return false;
  }
}

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<MessageResponse> {
  const body = forgotPasswordRequestSchema.parse(payload);
  const response = await apiRequest<unknown>({
    method: "POST",
    path: "/api/auth/forgot-password",
    body,
  });
  return messageResponseSchema.parse(response);
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<MessageResponse> {
  const body = resetPasswordRequestSchema.parse(payload);
  const response = await apiRequest<unknown>({
    method: "POST",
    path: "/api/auth/reset-password",
    body,
  });
  return messageResponseSchema.parse(response);
}
