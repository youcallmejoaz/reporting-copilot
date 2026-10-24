import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun, paths, type RecapEmail, type WeeklyReport } from "@arc/core";
import { STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

function readOutputs(pdfPath: string | null): { report: WeeklyReport; email: RecapEmail } | null {
  if (!pdfPath) return null;
  const json = path.join(paths.reports(), pdfPath.replace(/\.pdf$/, ".json"));
  return fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, "utf8")) : null;
}

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ client?: string }> }) {
  const run = getRun((await params).id);
  if (!run) notFound();
  const { client } = await searchParams;
  const selected = run.items.find((i) => i.client_id === client) ?? run.items[0];
  const out = selected ? readOutputs(selected.pdf_path) : null;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="small muted">
            <Link href="/">Weekly reports</Link> / {run.id}
          </div>
          <h1>reports/{run.report_date}/</h1>
          <p className="lede">
            {run.items.filter((i) => i.status === "done").length} PDFs · data as of {run.as_of} · writer: {run.mode}
          </p>
        </div>
      </div>
      <div className="tabs">
        {run.items.map((i) => (
          <Link key={i.client_id} href={`/runs/${run.id}?client=${i.client_id}`} className={i.client_id === selected?.client_id ? "active" : ""}>
            {i.client_name}
          </Link>
        ))}
      </div>
      {!selected ? null : !out ? (
        <div className="empty">{STATUS_LABEL[selected.status]}{selected.error ? `: ${selected.error}` : ""}</div>
      ) : (
        <div className="grid g2">
          <div className="card">
            <div className="row spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Report</h2>
              <a className="btn primary" href={`/files/${selected.pdf_path}`} target="_blank" rel="noreferrer" data-testid="open-pdf">
                📄 Open PDF
              </a>
            </div>
            <p className="ink2" style={{ marginTop: 0 }}>{out.report.summary}</p>
            <h3 className="small" style={{ color: "var(--good-text)", margin: "14px 0 4px" }}>✓ Wins</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{out.report.wins.map((w) => <li key={w}>{w}</li>)}</ul>
            <h3 className="small" style={{ color: "var(--bad-text)", margin: "14px 0 4px" }}>✕ Misses</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{out.report.misses.map((w) => <li key={w}>{w}</li>)}</ul>
            <h3 className="small" style={{ color: "var(--warn-text)", margin: "14px 0 4px" }}>→ Next actions</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{out.report.next_actions.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
          <div className="card" data-testid="recap-email">
            <div className="row spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Recap email draft</h2>
              <span className="pill warn">
                <span className="dot" />
                Draft · not sent
              </span>
            </div>
            <dl className="kv">
              <dt>To</dt>
              <dd>{out.email.to}</dd>
              <dt>Subject</dt>
              <dd>
                <b>{out.email.subject}</b>
              </dd>
            </dl>
            <pre className="email" style={{ marginTop: 12 }}>{out.email.body}</pre>
          </div>
        </div>
      )}
    </>
  );
}
