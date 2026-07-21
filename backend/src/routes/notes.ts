import {
  createNoteRequestSchema,
  listNotesQuerySchema,
  updateNoteRequestSchema,
} from "@take-note/shared";
import { Router, type Request, type Response } from "express";

import { authenticateToken } from "../middleware/authenticateToken.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  createNote,
  getActiveNoteById,
  listActiveNotes,
  listSoftDeletedNotes,
  restoreNote,
  softDeleteNote,
  updateNote,
} from "../services/noteService.js";

function zodIssuesToFields(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    fields[key] = issue.message;
  }
  return fields;
}

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
  }
  return req.user.id;
}

export const notesRouter: Router = Router();

notesRouter.use(authenticateToken);

notesRouter.post("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = createNoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid note payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const note = await createNote(userId, parsed.data);
  res.status(201).json(note);
});

notesRouter.get("/", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = listNotesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid query parameters",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const result = await listActiveNotes(userId, parsed.data);
  res.status(200).json(result);
});

notesRouter.get("/trash", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = listNotesQuerySchema.safeParse(req.query);
  const query = parsed.success
    ? parsed.data
    : { page: 1, limit: 20, sortBy: "updatedAt" as const, sortOrder: "desc" as const };

  const result = await listSoftDeletedNotes(userId, query);
  res.status(200).json(result);
});

notesRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const note = await getActiveNoteById(userId, req.params.id as string);
  res.status(200).json(note);
});

notesRouter.put("/:id", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  const parsed = updateNoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid note payload",
      zodIssuesToFields(parsed.error.issues),
    );
  }

  const note = await updateNote(userId, req.params.id as string, parsed.data);
  res.status(200).json(note);
});

notesRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  await softDeleteNote(userId, req.params.id as string);
  res.status(200).json({ message: "Note moved to trash successfully" });
});

notesRouter.post("/:id/restore", async (req: Request, res: Response) => {
  const userId = requireUserId(req);

  await restoreNote(userId, req.params.id as string);
  res.status(200).json({ message: "Note restored successfully" });
});
