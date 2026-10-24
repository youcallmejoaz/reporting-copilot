"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DraftAd } from "@arc/core";

export function DraftCard({ draft, clientName, current }: { draft: DraftAd; clientName: string; current: { name: string; headline: string; primary_text: string } | null }) {
  const [busy, setBusy] = useState<null | "APPROVED" | "REJECTED">(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(decision);
    setError(null);
    const res = await fetch(`/api/drafts/${draft.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    if (!res.ok) setError(((await res.json()) as { error: string }).error);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="card" data-testid={`draft-${draft.id}`}>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <div>
          <div className="small muted">
            {clientName} · {draft.campaign_name}
          </div>
          <h2 style={{ margin: "2px 0 0" }} className="mono">
            {draft.name}
          </h2>
        </div>
        <span className="pill warn" data-testid="draft-status">
          <span className="dot" />
          Paused
        </span>
      </div>
      <div className="grid g2" style={{ gap: 12 }}>
        {current ? (
          <div>
            <div className="small muted" style={{ marginBottom: 4 }}>
              Current ad · {current.name}
            </div>
            <div className="ad-preview" style={{ opacity: 0.7 }}>
              <div className="hl">{current.headline}</div>
              <div className="ink2">{current.primary_text}</div>
            </div>
          </div>
        ) : null}
        <div>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Proposed refresh
          </div>
          <div className="ad-preview" style={{ borderColor: "var(--ink-2)" }}>
            <div className="hl">{draft.headline}</div>
            <div className="ink2">{draft.primary_text}</div>
          </div>
        </div>
      </div>
      <p className="small ink2" style={{ margin: "12px 0" }}>
        {draft.rationale}
      </p>
      <div className="paused-banner">⏸ Created on the ad platform as PAUSED. It will not spend until approved.</div>
      {error ? <p style={{ color: "var(--bad-text)" }}>{error}</p> : null}
      <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
        <button className="btn reject" onClick={() => decide("REJECTED")} disabled={busy !== null} data-testid="reject">
          ✕ Reject
        </button>
        <button className="btn approve" onClick={() => decide("APPROVED")} disabled={busy !== null} data-testid="approve">
          {busy === "APPROVED" ? "Approving…" : "✓ Approve"}
        </button>
      </div>
    </div>
  );
}
