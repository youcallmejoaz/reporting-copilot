"use client";
import Link from "next/link";
import { useState } from "react";
import type { AuditFinding } from "@arc/core";

export function AuditRunner({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafted, setDrafted] = useState<Record<string, string>>({});

  async function run() {
    setBusy(true);
    const res = await fetch("/api/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: clientId }) });
    const data = (await res.json()) as { findings: AuditFinding[] };
    setFindings(data.findings);
    setBusy(false);
  }

  async function draft(f: AuditFinding) {
    const res = await fetch("/api/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: clientId, campaign_id: f.campaign_id }) });
    const d = (await res.json()) as { id: string };
    setDrafted((x) => ({ ...x, [f.entity_id]: d.id }));
  }

  const red = findings?.filter((f) => f.severity === "red").length ?? 0;
  return (
    <div className="card">
      <div className="row spread" style={{ marginBottom: findings ? 16 : 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>{clientName}</h2>
          <div className="small muted">
            {findings ? `${findings.length} finding(s) · ${red} red · ${findings.length - red} amber · via audit_account (MCP)` : "Checks the last 14 days of Meta + Google data"}
          </div>
        </div>
        <button className="btn primary" onClick={run} disabled={busy} data-testid="run-audit">
          {busy ? "Auditing…" : findings ? "↻ Re-run audit" : "▶ Run audit"}
        </button>
      </div>
      {findings?.length === 0 ? <div className="empty">No problems found.</div> : null}
      <div className="grid" style={{ gap: 10 }}>
        {findings?.map((f) => (
          <div key={f.rule + f.entity_id} className={`finding ${f.severity}`} data-testid={`finding-${f.rule}`}>
            <div className="icon">{f.severity === "red" ? "!" : "•"}</div>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span className="name">{f.entity_name}</span>
                <span className={`pill ${f.severity === "red" ? "bad" : "warn"}`}>{f.rule.replace(/_/g, " ")}</span>
              </div>
              <div className="reason">{f.reason}</div>
              <div className="fix">Fix: {f.recommendation}</div>
            </div>
            <div>
              {(f.rule === "low_ctr" || f.rule === "roas_below_1") && f.campaign_id ? (
                drafted[f.entity_id] ? (
                  <Link className="btn" href="/drafts">
                    ⏸ Draft {drafted[f.entity_id]} (paused) →
                  </Link>
                ) : (
                  <button className="btn" onClick={() => draft(f)}>
                    Draft refresh (paused)
                  </button>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
