import type { ReactElement } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { RegisterPage } from "../features/auth/RegisterPage.js";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage.js";
import { NoteEditorPage } from "../features/notes/NoteEditorPage.js";
import { NotesListPage } from "../features/notes/NotesListPage.js";
import { PublicSharePage } from "../features/notes/PublicSharePage.js";
import { TrashPage } from "../features/notes/TrashPage.js";
import { SearchPage } from "../features/search/SearchPage.js";
import { ProtectedRoute } from "./ProtectedRoute.js";

export function AppRouter(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/share/:token" element={<PublicSharePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <NotesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes/new"
          element={
            <ProtectedRoute>
              <NoteEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes/:id"
          element={
            <ProtectedRoute>
              <NoteEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trash"
          element={
            <ProtectedRoute>
              <TrashPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
