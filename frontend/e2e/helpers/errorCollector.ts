import type { Page } from "@playwright/test";

export type ErrorCollector = {
  readonly errors: string[];
};

export function attachErrorCollector(page: Page): ErrorCollector {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  page.on("console", (message) => {
    // Chromium auto-logs every non-2xx resource fetch as a console error, including
    // App.tsx's intentional silent session-restore probe (`POST /api/auth/refresh`),
    // which 401s by design before the user has logged in. That's expected browser
    // noise, not an application bug, so it's excluded here; genuine uncaught
    // exceptions are still caught via the pageerror listener above.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(message.text());
    }
  });

  return { errors };
}
