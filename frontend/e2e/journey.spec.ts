/**
 * Full application journey (FR-E2E-001): register -> log out -> log in -> note
 * creation/editing -> tagging -> search -> sharing -> version history -> logout,
 * driven end-to-end against the real backend and database (not mocked).
 *
 * Prerequisites (not started by this file, see frontend/CLAUDE.md's `test:e2e` entry):
 * - Both Postgres containers running: `docker compose up notes_dev notes_test`.
 * - Backend running with `NODE_ENV=test` against `TEST_DATABASE_URL` — this bypasses
 *   the auth rate limiters (see backend/src/middleware/authRateLimiters.ts), which
 *   would otherwise block repeated local runs of this test's registration/login steps.
 * - Backend's `WEB_ORIGIN` set to `http://localhost:4173` — this suite's Playwright
 *   preview server port (see playwright.config.ts), not the Vite dev server's 5173.
 *   A mismatched origin fails every request via CORS (see backend/src/app.ts's cors
 *   config), which would otherwise be misread as an application error.
 */
import { authResponseSchema } from "@take-note/shared";
import { expect, test } from "@playwright/test";

import { createTagViaApi, extractShareToken, fetchPublicShare } from "./helpers/apiHelpers.js";
import { attachErrorCollector } from "./helpers/errorCollector.js";
import { createTestUser } from "./helpers/testUser.js";

const NOTE_ID_PATTERN = /\/notes\/[0-9a-f-]{36}$/;
const SAVE_TIMEOUT = 10_000;

test("user completes the full application journey without application errors", async ({
  page,
  request,
}) => {
  const errorCollector = attachErrorCollector(page);
  const testUser = createTestUser();
  let accessToken = "";

  await test.step("register", async () => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByText(testUser.email)).toBeVisible();
  });

  await test.step("log out", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL((url) => url.pathname === "/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  await test.step("log in", async () => {
    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/login") && response.request().method() === "POST",
    );
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Log in" }).click();
    const loginResponse = await loginResponsePromise;
    accessToken = authResponseSchema.parse(await loginResponse.json()).accessToken;
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByText(testUser.email)).toBeVisible();
  });

  await test.step("create note", async () => {
    await page.getByRole("button", { name: "New Note" }).click();
    await page.waitForURL((url) => NOTE_ID_PATTERN.test(url.pathname));
    await page.getByLabel("Note title").fill("Journey Note");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Content for the end-to-end journey.");
    await expect(page.getByText("Saved")).toBeVisible({ timeout: SAVE_TIMEOUT });
  });

  let tagName = "";
  await test.step("tagging", async () => {
    const tag = await createTagViaApi(request, accessToken, "Journey", "#4f46e5");
    tagName = tag.name;

    // The tag was created via a direct API call, bypassing the page's already-fetched
    // TanStack Query tags cache; reload so TagPicker refetches and shows it.
    await page.reload();
    await page.getByLabel("Note title").waitFor();

    await page.getByLabel(tagName).check();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: SAVE_TIMEOUT });

    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/");
    await page.getByLabel(tagName).check();
    await expect(page.getByText("Journey Note")).toBeVisible();
  });

  await test.step("search", async () => {
    await page.getByRole("link", { name: "Search" }).click();
    await page.getByLabel("Search your notes").fill("journey");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("heading", { name: "Journey Note" })).toBeVisible();
    await expect(page.locator("mark").first()).toBeVisible();

    await page.getByRole("heading", { name: "Journey Note" }).click();
    await page.waitForURL((url) => NOTE_ID_PATTERN.test(url.pathname));
  });

  let shareLink = "";
  await test.step("sharing", async () => {
    await page.getByRole("button", { name: "Share" }).click();
    const dialog = page.getByRole("dialog", { name: "Share note" });
    await dialog.getByRole("button", { name: "Generate link" }).click();

    const shareLinkLocator = dialog.getByText(/^http/);
    await expect(shareLinkLocator).toBeVisible();
    shareLink = (await shareLinkLocator.textContent()) ?? "";
    await expect(dialog.getByText(/^Expires:/)).toBeVisible();
    await expect(dialog.getByText("Views: 0")).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();

    const token = extractShareToken(shareLink);
    const publicView = await fetchPublicShare(request, token);
    expect(publicView.status).toBe(200);
    expect(publicView.body.title).toBe("Journey Note");
  });

  await test.step("version history", async () => {
    await page.getByRole("button", { name: "History" }).click();
    const drawer = page.getByRole("dialog", { name: "Version history" });
    await drawer.getByRole("button", { name: /^Version 1 —/ }).click();
    await expect(drawer.getByText("Untitled")).toBeVisible();
    await drawer.getByRole("button", { name: "Restore version 1" }).click();

    await expect(page.getByLabel("Note title")).toHaveValue("Untitled");
    await expect(page.locator(".ProseMirror")).not.toContainText(
      "Content for the end-to-end journey.",
    );
  });

  await test.step("logout", async () => {
    await page.goBack();
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL((url) => url.pathname === "/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  expect(
    errorCollector.errors,
    `Unexpected browser errors: ${errorCollector.errors.join("; ")}`,
  ).toHaveLength(0);
});
