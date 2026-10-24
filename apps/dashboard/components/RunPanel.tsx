"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RunItemRow, RunRow } from "@arc/core";
import { STATUS_LABEL } from "@/lib/format";

type Run = RunRow & { items: RunItemRow[] };
const ORDER = ["pulling", "writing", "rendering", "done"];

function Steps({ status }: { status: string }) {
  const idx = ORDER.indexOf(status);
  return (
    <div className="steps">
      {ORDER.map((s, i) => (
        <div key={s} className={`step ${status === "failed" ? "fail" : status === "done" ? "done" : i < idx ? "done" : i === idx ? "on" : ""}`} />
      ))}
    </div>
  );
}

export function RunPanel({ initial }: { initial: Run | null }) {
  const [run, setRun] = useState<Run | null>(initial);
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const running = run?.status === "running";

  useEffect(() => {
    if (!running || !run) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as Run;
      setRun(next);
      if (next.status !== "running") {
        clearInterval(t);
        router.refresh();
      }
    }, 400);
    return () => clearInterval(t);
  }, [running, run?.id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setStarting(true);
    try {
      const res = await fetch("/api/runs", { method: "POST" });
      const { run_id } = (await res.json()) as { run_id: string };
      const r = await fetch(`/api/runs/${run_id}`, { cache: "no-store" });
      setRun((await r.json()) as Run);
    } finally {
      setStarting(false);
    }
  }

  const done = run?.items.filter((i) => i.status === "done").length ?? 0;
  return (
    <div className="card" data-testid="run-panel">
      <div className="row spread" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{run ? (running ? "Running weekly reports…" : `Latest run · reports/${run.report_date}/`) : "No runs yet"}</h2>
          {run ? (
            <div className="small muted">
              {done}/{run.items.length} clients done · writer: {run.mode}
            </div>
          ) : null}
        </div>
        <div className="row">
          {run && !running ? (
            <Link className="btn" href={`/runs/${run.id}`}>
              Open run
            </Link>
          ) : null}
          <button className="btn primary" onClick={start} disabled={starting || running} data-testid="run-weekly">
            {running ? "Running…" : "▶ Run weekly reports"}
          </button>
        </div>
      </div>
      {run?.items.map((i) => (
        <div className="run-row" key={i.client_id} data-testid={`run-item-${i.client_id}`}>
          <div>
            <b>{i.client_name}</b>
          </div>
          <Steps status={i.status} />
          <div className="small ink2">{STATUS_LABEL[i.status]}</div>
          <div style={{ textAlign: "right" }}>
            {i.status === "done" && i.pdf_path ? (
              <a className="btn" href={`/files/${i.pdf_path}`} target="_blank" rel="noreferrer">
                📄 PDF
              </a>
            ) : i.status === "failed" ? (
              <span className="pill bad" title={i.error ?? ""}>
                failed
              </span>
            ) : (
              <span className="muted small">{i.duration_ms ? `${(i.duration_ms / 1000).toFixed(1)}s` : ""}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
