import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function looksLikeRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, "clients")) && fs.existsSync(path.join(dir, "data", "sample"));
}

function walkUp(start: string): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (looksLikeRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

let cachedRoot: string | null = null;

function moduleDir(): string | null {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

/**
 * Repo root: ARC_ROOT env, else the nearest parent of cwd containing clients/ and data/sample/,
 * else the nearest parent of this file (so `node packages/mcp-server/dist/index.js` works from any cwd).
 */
export function repoRoot(): string {
  if (process.env.ARC_ROOT) return path.resolve(process.env.ARC_ROOT);
  if (cachedRoot) return cachedRoot;
  const here = moduleDir();
  const found = walkUp(process.cwd()) ?? (here ? walkUp(here) : null);
  if (!found) {
    throw new Error("Could not find the repo root (clients/ + data/sample/). Set ARC_ROOT to the repo path.");
  }
  cachedRoot = found;
  return found;
}

function fromRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.join(repoRoot(), p);
}

export const paths = {
  sampleData: () => path.join(repoRoot(), "data", "sample"),
  clients: () => path.join(repoRoot(), "clients"),
  prompts: () => path.join(repoRoot(), "packages", "core", "prompts"),
  db: () => fromRoot(process.env.DB_PATH || "data/copilot.db"),
  reports: () => fromRoot(process.env.REPORTS_DIR || "reports"),
};

/** The last complete day of data. Every relative range ("this month", "last 7 days") ends here. */
export function asOfDate(): string {
  if (process.env.AS_OF_DATE) return process.env.AS_OF_DATE;
  // Sample data ends on a fixed day; live ad accounts report up to yesterday.
  if ((process.env.ADS_ADAPTER || "mock") === "mock") return "2026-10-22";
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}
