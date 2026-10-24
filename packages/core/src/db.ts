import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { paths } from "./paths";

// Loaded at runtime so bundlers (tsup/esbuild, Next.js) cannot rewrite the "node:sqlite" specifier.
const { DatabaseSync: Database } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  trigger TEXT NOT NULL,
  report_date TEXT NOT NULL,
  as_of TEXT NOT NULL,
  mode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS run_items (
  run_id TEXT NOT NULL REFERENCES runs(id),
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','pulling','writing','rendering','done','failed')),
  pdf_path TEXT,
  email_path TEXT,
  duration_ms INTEGER,
  error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (run_id, client_id)
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  ad_set_id TEXT NOT NULL,
  replaces_ad_id TEXT,
  name TEXT NOT NULL,
  headline TEXT NOT NULL,
  primary_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PAUSED','APPROVED','REJECTED')),
  external_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('read','draft','approve','system')),
  client_id TEXT,
  args_json TEXT,
  result TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS audit_log_ts ON audit_log(ts);
`;

let db: DatabaseSync | null = null;
let dbPath: string | null = null;

export function getDb(): DatabaseSync {
  const p = paths.db();
  if (db && dbPath === p) return db;
  if (db) db.close();
  if (p !== ":memory:") fs.mkdirSync(path.dirname(p), { recursive: true });
  db = new Database(p);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  dbPath = p;
  return db;
}

/** Close the connection (tests switch DB_PATH between suites). */
export function closeDb(): void {
  db?.close();
  db = null;
  dbPath = null;
}

export const nowIso = () => new Date().toISOString();

/** node:sqlite returns null-prototype rows; copy them into plain objects (React and JSON-friendly). */
export function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}
export function plainAll<T>(rows: unknown[]): T[] {
  return rows.map((r) => plain<T>(r));
}
