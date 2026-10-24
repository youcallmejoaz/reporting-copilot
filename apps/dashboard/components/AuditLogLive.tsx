"use client";
import { useEffect, useRef, useState } from "react";
import type { AuditEntry } from "@arc/core";
import { clock } from "@/lib/format";

function resultPill(e: AuditEntry) {
  if (e.result === "ok") return <span className={`pill ${e.scope === "approve" ? "good" : ""}`}>{e.scope}</span>;
  return <span className="pill bad">{e.result}</span>;
}

export function AuditLogLive({ initial, compact = false }: { initial: AuditEntry[]; compact?: boolean }) {
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const last = useRef(initial[0]?.id ?? 0);

  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/audit-log?after=${last.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as AuditEntry[];
      if (next.length === 0) return;
      last.current = next[0].id;
      setFresh(new Set(next.map((n) => n.id)));
      setRows((r) => [...next, ...r].slice(0, compact ? 12 : 200));
    }, 700);
    return () => clearInterval(t);
  }, [compact]);

  return (
    <div className="card" data-testid="audit-log">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Audit log</h2>
        <span className="small muted">live</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {rows.length === 0 ? <div className="empty">No activity yet.</div> : null}
        {rows.map((e) => (
          <div key={e.id} className={`log-row ${fresh.has(e.id) ? "fresh" : ""}`} style={compact ? { gridTemplateColumns: "72px 1fr auto" } : undefined}>
            <span className="muted mono">{clock(e.ts)}</span>
            {compact ? null : <span className="ink2">{e.actor}</span>}
            <span>
              <b className="mono">{e.action}</b>
              {e.client_id ? <span className="muted"> · {e.client_id}</span> : null}
              {e.detail && (compact ? e.scope === "approve" : true) ? <div className="small ink2">{e.detail}</div> : null}
              {compact ? <div className="small muted">{e.actor}</div> : null}
            </span>
            {resultPill(e)}
          </div>
        ))}
      </div>
    </div>
  );
}
