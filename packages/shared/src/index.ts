export const SHARED_PACKAGE_NAME = "@take-note/shared";

export {
  registerRequestSchema,
  loginRequestSchema,
  authUserSchema,
  authResponseSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  messageResponseSchema,
} from "./auth/schemas.js";
export type {
  RegisterRequest,
  LoginRequest,
  AuthUser,
  AuthResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  MessageResponse,
} from "./auth/schemas.js";
