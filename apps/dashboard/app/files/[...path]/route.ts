import fs from "node:fs";
import path from "node:path";
import { paths } from "@arc/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = { ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8", ".json": "application/json" };

/** Serve generated reports from REPORTS_DIR (read-only, no directory traversal). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = path.resolve(paths.reports());
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep) || !TYPES[path.extname(file)] || !fs.existsSync(file)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(fs.readFileSync(file), {
    headers: { "content-type": TYPES[path.extname(file)], "content-disposition": `inline; filename="${path.basename(file)}"`, "cache-control": "no-store" },
  });
}
