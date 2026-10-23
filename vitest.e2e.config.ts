import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    pool: "forks",
  },
});
