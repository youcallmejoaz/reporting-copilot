import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@arc/core", "@arc/mcp-server", "@arc/agent"],
  serverExternalPackages: ["playwright", "playwright-core", "@anthropic-ai/sdk"],
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  typescript: { tsconfigPath: "tsconfig.json" },
};

export default nextConfig;
