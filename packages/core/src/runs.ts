import { getDb, nowIso } from "./db.js";

export type RunItemStatus = "queued" | "pulling" | "writing" | "rendering" | "done" | "failed";

export interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "succeeded" | "failed";
  trigger: string;
  report_date: string;
  as_of: string;
  mode: string;
}

export interface RunItemRow {
  run_id: string;
  client_id: string;
  client_name: string;
  status: RunItemStatus;
  pdf_path: string | null;
  email_path: string | null;
  duration_ms: number | null;
  error: string | null;
  updated_at: string;
}

export function createRun(r: Omit<RunRow, "finished_at" | "status" | "started_at">): RunRow {
  const row: RunRow = { ...r, started_at: nowIso(), finished_at: null, status: "running" };
  getDb()
    .prepare("INSERT INTO runs (id, started_at, finished_at, status, trigger, report_date, as_of, mode) VALUES (?, ?, NULL, 'running', ?, ?, ?, ?)")
    .run(row.id, row.started_at, row.trigger, row.report_date, row.as_of, row.mode);
  return row;
}

export function finishRun(id: string, status: "succeeded" | "failed"): void {
  getDb().prepare("UPDATE runs SET status = ?, finished_at = ? WHERE id = ?").run(status, nowIso(), id);
}

export function upsertRunItem(item: Partial<RunItemRow> & Pick<RunItemRow, "run_id" | "client_id">): void {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM run_items WHERE run_id = ? AND client_id = ?").get(item.run_id, item.client_id) as unknown as RunItemRow | undefined;
  const merged: RunItemRow = {
    client_name: item.client_id,
    status: "queued",
    pdf_path: null,
    email_path: null,
    duration_ms: null,
    error: null,
    ...existing,
    ...item,
    updated_at: nowIso(),
  } as RunItemRow;
  db.prepare(
    `INSERT INTO run_items (run_id, client_id, client_name, status, pdf_path, email_path, duration_ms, error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(run_id, client_id) DO UPDATE SET client_name=excluded.client_name, status=excluded.status, pdf_path=excluded.pdf_path,
       email_path=excluded.email_path, duration_ms=excluded.duration_ms, error=excluded.error, updated_at=excluded.updated_at`,
  ).run(merged.run_id, merged.client_id, merged.client_name, merged.status, merged.pdf_path, merged.email_path, merged.duration_ms, merged.error, merged.updated_at);
}

export function listRuns(limit = 20): RunRow[] {
  return getDb().prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?").all(limit) as unknown as RunRow[];
}

export function getRun(id: string): (RunRow & { items: RunItemRow[] }) | null {
  const run = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as unknown as RunRow | undefined;
  if (!run) return null;
  const items = getDb().prepare("SELECT * FROM run_items WHERE run_id = ? ORDER BY client_name").all(id) as unknown as RunItemRow[];
  return { ...run, items };
}
