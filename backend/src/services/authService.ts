import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { AppError } from "../middleware/errorHandler.js";
import * as refreshTokenService from "./refreshTokenService.js";
import * as userRepository from "./userRepository.js";

export interface AuthUserDto {
  id: string;
  email: string;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUserDto;
  refreshToken: { token: string; expiresAt: Date };
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function issueAuthResult(user: { id: string; email: string }): Promise<AuthResult> {
  const accessToken = signAccessToken(user);
  const refreshToken = await refreshTokenService.issue(user.id);

  return { accessToken, user: { id: user.id, email: user.email }, refreshToken };
}

export async function registerUser(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  const existing = await userRepository.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError(422, "CONFLICT", "Email is already registered", {
      email: "Already registered",
    });
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create(normalizedEmail, passwordHash);

  return issueAuthResult(user);
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, "UNAUTHORIZED", INVALID_CREDENTIALS_MESSAGE);
  }

  return issueAuthResult(user);
}

export async function logoutUser(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await refreshTokenService.revoke(refreshToken);
}

export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const rotated = await refreshTokenService.rotate(refreshToken);
  if (!rotated) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
  }

  const user = await userRepository.findById(rotated.userId);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
  }

  const accessToken = signAccessToken(user);

  return {
    accessToken,
    user: { id: user.id, email: user.email },
    refreshToken: { token: rotated.token, expiresAt: rotated.expiresAt },
  };
}
