import { defineConfig } from "tsup";

// Bundle the workspace core (TypeScript source) into dist/index.js; keep npm dependencies external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  noExternal: ["@arc/core"],
  external: ["playwright", "@anthropic-ai/sdk"],
});
