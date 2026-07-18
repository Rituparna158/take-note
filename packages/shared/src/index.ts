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

export {
  tiptapMarkSchema,
  tiptapNodeSchema,
  tiptapDocumentSchema,
  createNoteRequestSchema,
  updateNoteRequestSchema,
  noteResponseSchema,
  noteListMetaSchema,
  noteListResponseSchema,
} from "./notes/schemas.js";
export type {
  TiptapMark,
  TiptapNode,
  TiptapDocument,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteResponse,
  NoteListMeta,
  NoteListResponse,
} from "./notes/schemas.js";
