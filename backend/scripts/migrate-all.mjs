import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(backendDir, ".env");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function run(args, envOverrides) {
  const result = spawnSync("npx", ["prisma", ...args], {
    cwd: backendDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...envOverrides },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const fileEnv = loadEnvFile(envPath);
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is not set (checked process.env and backend/.env).");
  process.exit(1);
}

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("Usage: pnpm --filter backend db:migrate -- <migration-name>");
  process.exit(1);
}

console.log("Applying migration to notes_dev (DATABASE_URL)...");
run(["migrate", "dev", "--name", migrationName]);

console.log("Applying the same migration to notes_test (TEST_DATABASE_URL)...");
run(["migrate", "deploy"], { DATABASE_URL: testDatabaseUrl });

console.log("Dual-database migration complete.");
