import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countPdfPages, getRun, listAuditLog, loadProfile, renderReportHtml, templateRecap } from "@arc/core";
import { runWeekly } from "@arc/agent";
import { CLIENT_IDS } from "./helpers";

describe("weekly report job", () => {
  it("produces one single-page PDF and one recap email per client in under 2 minutes", async () => {
    const t0 = Date.now();
    const result = await runWeekly({ trigger: "test", reportDate: "2026-10-23" });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(120_000);
    expect(result.status).toBe("succeeded");
    expect(result.report_dir).toBe(path.join(process.env.REPORTS_DIR!, "2026-10-23"));
    const pdfs = fs.readdirSync(result.report_dir).filter((f) => f.endsWith(".pdf")).sort();
    expect(pdfs).toEqual(CLIENT_IDS.map((c) => `${c}.pdf`));
    for (const f of pdfs) {
      const buf = fs.readFileSync(path.join(result.report_dir, f));
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(countPdfPages(buf)).toBe(1);
    }
    for (const c of CLIENT_IDS) expect(fs.existsSync(path.join(result.report_dir, `${c}-recap-email.md`))).toBe(true);

    const run = getRun(result.run_id)!;
    expect(run.status).toBe("succeeded");
    expect(run.items.every((i) => i.status === "done" && i.pdf_path)).toBe(true);
    // The job pulls its numbers through the MCP tools, so they are in the audit log under the runner.
    const runnerCalls = listAuditLog({ limit: 200 }).filter((e) => e.actor === "runner" && e.scope === "read");
    expect(new Set(runnerCalls.map((e) => e.action))).toEqual(new Set(["list_clients", "get_campaign_metrics", "get_mtd_summary", "audit_account"]));

    // Wins / misses / next actions, and the planted ROAS < 1 campaign is called out as a miss.
    const gf = JSON.parse(fs.readFileSync(path.join(result.report_dir, "glowfield-skincare.json"), "utf8"));
    expect(gf.report.wins.length).toBeGreaterThan(0);
    expect(gf.report.next_actions.length).toBeGreaterThan(0);
    expect(gf.report.misses.join(" ")).toContain("GF_META_PROS_BroadVideo");

    // White label: nothing about the agency, MCP or Claude in what the end client sees.
    const np = JSON.parse(fs.readFileSync(path.join(result.report_dir, "northstar-partners.json"), "utf8"));
    const html = renderReportHtml(np.report);
    const email = fs.readFileSync(path.join(result.report_dir, "northstar-partners-recap-email.md"), "utf8").split("---")[1];
    for (const text of [html, email]) expect(text).not.toMatch(/claude|mcp|our team|test mode/i);
    expect(email).toContain("Northstar Partners Paid Media");
  });

  it("uses the client's tone for the recap email", async () => {
    const result = await runWeekly({ trigger: "test", reportDate: "tone-check", clientIds: ["harbor-law", "ridgeline-roofing"] });
    const hl = JSON.parse(fs.readFileSync(path.join(result.report_dir, "harbor-law.json"), "utf8"));
    const formal = templateRecap(hl.report, loadProfile("harbor-law"));
    expect(formal.body.startsWith("Dear Ms. Shah,")).toBe(true);
    expect(formal.body).toContain("Kind regards,");
    expect(formal.body).not.toContain("!");
    const rr = JSON.parse(fs.readFileSync(path.join(result.report_dir, "ridgeline-roofing.json"), "utf8"));
    expect(templateRecap(rr.report, loadProfile("ridgeline-roofing")).body.startsWith("Dave,")).toBe(true);
  });
});
