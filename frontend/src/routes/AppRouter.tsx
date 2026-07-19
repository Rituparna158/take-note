import type { ReactElement } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthenticatedPlaceholderPage } from "../features/auth/AuthenticatedPlaceholderPage.js";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { RegisterPage } from "../features/auth/RegisterPage.js";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage.js";
import { ProtectedRoute } from "./ProtectedRoute.js";

export function AppRouter(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AuthenticatedPlaceholderPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
