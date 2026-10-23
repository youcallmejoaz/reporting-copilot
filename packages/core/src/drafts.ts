import { randomUUID } from "node:crypto";
import { getAdapter } from "./adapters/index.js";
import { logAction, type Actor } from "./audit-log.js";
import { getDb, nowIso } from "./db.js";
import type { DraftAd, DraftStatus } from "./types.js";

/**
 * Input for a new draft. There is deliberately no `status` field: every draft is created PAUSED.
 */
export type NewDraft = Pick<DraftAd, "client_id" | "campaign_id" | "campaign_name" | "ad_set_id" | "replaces_ad_id" | "name" | "headline" | "primary_text" | "rationale">;

export async function createPausedDraft(input: NewDraft, actor: Actor): Promise<DraftAd> {
  // Build the row explicitly so nothing extra (e.g. a smuggled `status`) from the input can reach the database.
  const { external_id } = await getAdapter().createPausedAd({
    client_id: input.client_id,
    campaign_id: input.campaign_id,
    ad_set_id: input.ad_set_id,
    name: input.name,
    headline: input.headline,
    primary_text: input.primary_text,
  });
  const draft: DraftAd = {
    id: `drf_${randomUUID().slice(0, 8)}`,
    client_id: input.client_id,
    campaign_id: input.campaign_id,
    campaign_name: input.campaign_name,
    ad_set_id: input.ad_set_id,
    replaces_ad_id: input.replaces_ad_id,
    name: input.name,
    headline: input.headline,
    primary_text: input.primary_text,
    rationale: input.rationale,
    status: "PAUSED",
    external_id,
    created_at: nowIso(),
    created_by: actor,
    decided_at: null,
    decided_by: null,
  };
  getDb()
    .prepare(
      `INSERT INTO drafts (id, client_id, campaign_id, campaign_name, ad_set_id, replaces_ad_id, name, headline, primary_text, rationale, status, external_id, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAUSED', ?, ?, ?)`,
    )
    .run(draft.id, draft.client_id, draft.campaign_id, draft.campaign_name, draft.ad_set_id, draft.replaces_ad_id, draft.name, draft.headline, draft.primary_text, draft.rationale, draft.external_id, draft.created_at, draft.created_by);
  return draft;
}

export function getDraft(id: string): DraftAd | null {
  return (getDb().prepare("SELECT * FROM drafts WHERE id = ?").get(id) as unknown as DraftAd) ?? null;
}

export function listDrafts(opts: { status?: DraftStatus; clientId?: string } = {}): DraftAd[] {
  const where: string[] = [];
  const params: string[] = [];
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts.clientId) {
    where.push("client_id = ?");
    params.push(opts.clientId);
  }
  return getDb()
    .prepare(`SELECT * FROM drafts ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`)
    .all(...params) as unknown as DraftAd[];
}

/**
 * The approval gate. Only the dashboard calls this (a human clicking Approve / Reject).
 * It is not exposed as an MCP tool.
 */
export async function decideDraft(id: string, decision: "APPROVED" | "REJECTED", actor: Actor): Promise<DraftAd> {
  const draft = getDraft(id);
  if (!draft) throw new Error(`Draft ${id} not found`);
  if (draft.status !== "PAUSED") {
    logAction({ actor, action: decision === "APPROVED" ? "approve_draft" : "reject_draft", scope: "approve", client_id: draft.client_id, args: { id }, result: "denied", detail: `already ${draft.status}` });
    throw new Error(`Draft ${id} was already ${draft.status.toLowerCase()}`);
  }
  if (decision === "APPROVED" && draft.external_id) {
    await getAdapter().activateAd(draft.client_id, draft.external_id);
  }
  const decidedAt = nowIso();
  getDb().prepare("UPDATE drafts SET status = ?, decided_at = ?, decided_by = ? WHERE id = ? AND status = 'PAUSED'").run(decision, decidedAt, actor, id);
  logAction({
    actor,
    action: decision === "APPROVED" ? "approve_draft" : "reject_draft",
    scope: "approve",
    client_id: draft.client_id,
    args: { id },
    result: "ok",
    detail: `${draft.name} (${draft.campaign_name}) ${decision === "APPROVED" ? "approved and set live" : "rejected, stays paused"}`,
  });
  return { ...draft, status: decision, decided_at: decidedAt, decided_by: actor };
}
