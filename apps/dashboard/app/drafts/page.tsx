import { getAdapter, listAuditLog, listDrafts, loadProfile } from "@arc/core";
import { DraftCard } from "@/components/DraftCard";
import { AuditLogLive } from "@/components/AuditLogLive";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const pending = listDrafts({ status: "PAUSED" });
  const decided = listDrafts().filter((d) => d.status !== "PAUSED");
  const ads = new Map<string, { name: string; headline: string; primary_text: string }>();
  for (const d of pending) {
    if (d.replaces_ad_id && !ads.has(d.replaces_ad_id)) {
      const a = (await getAdapter().listAds(d.client_id)).find((x) => x.id === d.replaces_ad_id);
      if (a) ads.set(a.id, a);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Draft approvals</h1>
          <p className="lede">Every ad change is created <b>paused</b>. Nothing runs until someone clicks Approve here. Each decision goes in the audit log.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", alignItems: "start" }}>
        <div className="grid">
          {pending.length === 0 ? <div className="empty">No drafts waiting for review.</div> : null}
          {pending.map((d) => (
            <DraftCard key={d.id} draft={d} clientName={loadProfile(d.client_id).settings.name} current={d.replaces_ad_id ? ads.get(d.replaces_ad_id) ?? null : null} />
          ))}
          {decided.length > 0 ? (
            <div className="card">
              <h2>Decided</h2>
              <table className="t">
                <tbody>
                  {decided.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <b>{d.name}</b>
                        <div className="small muted">{d.campaign_name}</div>
                      </td>
                      <td>
                        <span className={`pill ${d.status === "APPROVED" ? "good" : "bad"}`}>
                          <span className="dot" />
                          {d.status === "APPROVED" ? "Approved · live" : "Rejected · stays paused"}
                        </span>
                      </td>
                      <td className="small muted">
                        {d.decided_by} · {d.decided_at ? timeAgo(d.decided_at) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <AuditLogLive initial={listAuditLog({ limit: 12 })} compact />
      </div>
    </>
  );
}
