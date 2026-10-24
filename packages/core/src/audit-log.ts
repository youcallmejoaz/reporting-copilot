import { getDb, nowIso, plainAll } from "./db";

export type Actor = "mcp" | "runner" | "dashboard" | "ask" | "system" | (string & {});
export type Scope = "read" | "draft" | "approve" | "system";

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string;
  action: string;
  scope: Scope;
  client_id: string | null;
  args_json: string | null;
  result: "ok" | "error" | "denied";
  detail: string | null;
}

export function logAction(e: { actor: Actor; action: string; scope: Scope; client_id?: string | null; args?: unknown; result: AuditEntry["result"]; detail?: string }): void {
  getDb()
    .prepare("INSERT INTO audit_log (ts, actor, action, scope, client_id, args_json, result, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(nowIso(), e.actor, e.action, e.scope, e.client_id ?? null, e.args === undefined ? null : JSON.stringify(e.args), e.result, e.detail ?? null);
}

export function listAuditLog(opts: { limit?: number; afterId?: number; clientId?: string } = {}): AuditEntry[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.afterId) {
    where.push("id > ?");
    params.push(opts.afterId);
  }
  if (opts.clientId) {
    where.push("client_id = ?");
    params.push(opts.clientId);
  }
  params.push(opts.limit ?? 100);
  return plainAll<AuditEntry>(getDb()
    .prepare(`SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`)
    .all(...params));
}
