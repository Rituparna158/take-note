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
  listNotesQuerySchema,
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
  ListNotesQuery,
} from "./notes/schemas.js";

export {
  createTagRequestSchema,
  updateTagRequestSchema,
  tagResponseSchema,
  tagWithCountResponseSchema,
  tagListResponseSchema,
} from "./tags/schemas.js";
export type {
  CreateTagRequest,
  UpdateTagRequest,
  TagResponse,
  TagWithCountResponse,
  TagListResponse,
} from "./tags/schemas.js";
