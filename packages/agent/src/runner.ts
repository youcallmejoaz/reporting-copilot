import fs from "node:fs";
import path from "node:path";
import {
  asOfDate,
  createRun,
  emailToMarkdown,
  finishRun,
  openPdfRenderer,
  loadProfile,
  logAction,
  modeLabel,
  paths,
  renderReportHtml,
  upsertRunItem,
  writeRecapEmail,
  writeWeeklyReport,
  type RunItemStatus,
  type WeeklyInputs,
} from "@arc/core";
import { callJson, connectInProcess } from "@arc/mcp-server";

export interface RunOptions {
  trigger?: "manual" | "schedule" | "cli" | "test" | (string & {});
  /** Folder name under reports/. Defaults to today's date. */
  reportDate?: string;
  clientIds?: string[];
  /** Optional pause between stages so progress is visible in demos. 0 in normal use. */
  stageDelayMs?: number;
  onProgress?: (clientId: string, status: RunItemStatus) => void;
}

export interface RunResult {
  run_id: string;
  report_dir: string;
  status: "succeeded" | "failed";
  duration_ms: number;
  items: { client_id: string; status: RunItemStatus; pdf_path?: string; email_path?: string; error?: string; duration_ms: number }[];
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start a run row and return its id immediately; the work continues in the background. */
export function startWeeklyRun(opts: RunOptions = {}): { run_id: string; done: Promise<RunResult> } {
  const run_id = `run_${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
  const reportDate = opts.reportDate ?? today();
  createRun({ id: run_id, trigger: opts.trigger ?? "manual", report_date: reportDate, as_of: asOfDate(), mode: modeLabel() });
  return { run_id, done: execute(run_id, reportDate, opts) };
}

export async function runWeekly(opts: RunOptions = {}): Promise<RunResult> {
  return startWeeklyRun(opts).done;
}

async function execute(runId: string, reportDate: string, opts: RunOptions): Promise<RunResult> {
  const t0 = Date.now();
  const outDir = path.join(paths.reports(), reportDate);
  fs.mkdirSync(outDir, { recursive: true });
  const delay = opts.stageDelayMs ?? Number(process.env.DEMO_STAGE_DELAY_MS || 0);
  // Read scope only: the report job can never draft or change ads.
  const { client, close } = await connectInProcess({ scopes: ["read"], actor: "runner" });
  const pdf = await openPdfRenderer();
  logAction({ actor: "runner", action: "weekly_run_started", scope: "system", args: { run_id: runId, report_date: reportDate }, result: "ok" });

  const items: RunResult["items"] = [];
  try {
    const { clients } = await callJson<{ clients: { client_id: string; name: string }[] }>(client, "list_clients", {});
    const selected = clients.filter((c) => !opts.clientIds || opts.clientIds.includes(c.client_id));
    for (const c of selected) upsertRunItem({ run_id: runId, client_id: c.client_id, client_name: c.name, status: "queued" });

    const setStatus = (id: string, status: RunItemStatus, extra: Record<string, unknown> = {}) => {
      upsertRunItem({ run_id: runId, client_id: id, status, ...extra });
      opts.onProgress?.(id, status);
    };

    await Promise.all(
      selected.map(async (c, i) => {
        const start = Date.now();
        try {
          if (delay) await sleep(delay * 0.4 * i);
          setStatus(c.client_id, "pulling");
          const [current, previous, mtd, audit] = await Promise.all([
            callJson<WeeklyInputs["current"]>(client, "get_campaign_metrics", { client_id: c.client_id, date_range: "last_7d", include_daily: true }),
            callJson<WeeklyInputs["previous"]>(client, "get_campaign_metrics", { client_id: c.client_id, date_range: "prev_7d" }),
            callJson<WeeklyInputs["mtd"]>(client, "get_mtd_summary", { client_id: c.client_id }),
            callJson<WeeklyInputs["audit"]>(client, "audit_account", { client_id: c.client_id }),
          ]);
          if (delay) await sleep(delay);
          setStatus(c.client_id, "writing");
          const profile = loadProfile(c.client_id);
          const report = await writeWeeklyReport({ current, previous, mtd, audit }, profile);
          const email = await writeRecapEmail(report, profile);
          if (delay) await sleep(delay);
          setStatus(c.client_id, "rendering");
          const pdfPath = path.join(outDir, `${c.client_id}.pdf`);
          const emailPath = path.join(outDir, `${c.client_id}-recap-email.md`);
          await pdf.render(renderReportHtml(report), pdfPath);
          fs.writeFileSync(emailPath, emailToMarkdown(email));
          fs.writeFileSync(path.join(outDir, `${c.client_id}.json`), JSON.stringify({ report, email }, null, 2));
          if (delay) await sleep(delay * 0.5);
          const rel = (p: string) => path.relative(paths.reports(), p);
          const duration_ms = Date.now() - start;
          setStatus(c.client_id, "done", { pdf_path: rel(pdfPath), email_path: rel(emailPath), duration_ms });
          items.push({ client_id: c.client_id, status: "done", pdf_path: pdfPath, email_path: emailPath, duration_ms });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const duration_ms = Date.now() - start;
          setStatus(c.client_id, "failed", { error: message, duration_ms });
          items.push({ client_id: c.client_id, status: "failed", error: message, duration_ms });
        }
      }),
    );
  } finally {
    await close();
    await pdf.close();
  }
  const status = items.length > 0 && items.every((i) => i.status === "done") ? "succeeded" : "failed";
  finishRun(runId, status);
  logAction({ actor: "runner", action: "weekly_run_finished", scope: "system", args: { run_id: runId }, result: status === "succeeded" ? "ok" : "error", detail: `${items.filter((i) => i.status === "done").length}/${items.length} reports in ${Date.now() - t0}ms` });
  return { run_id: runId, report_dir: outDir, status, duration_ms: Date.now() - t0, items };
}
