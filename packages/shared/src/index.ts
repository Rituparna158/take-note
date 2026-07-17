export const SHARED_PACKAGE_NAME = "@take-note/shared";

export {
  registerRequestSchema,
  loginRequestSchema,
  authUserSchema,
  authResponseSchema,
} from "./auth/schemas.js";
export type { RegisterRequest, LoginRequest, AuthUser, AuthResponse } from "./auth/schemas.js";
