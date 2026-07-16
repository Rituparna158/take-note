export default {
  "backend/**/*.ts": [
    "eslint --fix",
    "prettier --write",
    () => "pnpm --filter backend exec tsc --noEmit",
  ],
  "frontend/**/*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    () => "pnpm --filter frontend exec tsc --noEmit",
  ],
  "packages/shared/**/*.ts": [
    "eslint --fix",
    "prettier --write",
    () => "pnpm --filter shared exec tsc --noEmit",
  ],
  "*.{json,md,yml,yaml}": ["prettier --write"],
};
