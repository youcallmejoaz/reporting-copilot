import Link from "next/link";
import { getRun, listRuns } from "@arc/core";
import { RunPanel } from "@/components/RunPanel";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function Home() {
  const runs = listRuns(15).map((r) => ({ ...r, items: getRun(r.id)?.items ?? [] }));
  const latest = runs[0] ?? null;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Weekly reports</h1>
          <p className="lede">One PDF and one recap email draft per client, built from the Ads Data MCP server. Scheduled every Monday 7:00.</p>
        </div>
      </div>
      <RunPanel initial={latest} />
      <div className="card" style={{ marginTop: 20 }}>
        <h2>Run history</h2>
        {runs.length === 0 ? (
          <div className="empty">No runs yet. Click “Run weekly reports”.</div>
        ) : (
          <table className="t">
            <thead>
              <tr>
                <th>Run</th>
                <th>Trigger</th>
                <th>Writer</th>
                <th>Status</th>
                <th className="n">PDFs</th>
                <th className="n">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const done = r.items.filter((i) => i.status === "done").length;
                const ms = r.finished_at ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime() : null;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/runs/${r.id}`}>
                        <b>reports/{r.report_date}/</b>
                      </Link>
                      <div className="small muted">{timeAgo(r.started_at)}</div>
                    </td>
                    <td className="ink2">{r.trigger}</td>
                    <td className="ink2 small">{r.mode}</td>
                    <td>
                      <span className={`pill ${r.status === "succeeded" ? "good" : r.status === "failed" ? "bad" : "warn"}`}>
                        <span className="dot" />
                        {r.status}
                      </span>
                    </td>
                    <td className="n">
                      {done}/{r.items.length}
                    </td>
                    <td className="n ink2">{ms === null ? "…" : `${(ms / 1000).toFixed(1)}s`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
