/**
 * Render one client's one-page PDF, optionally using a narrative Claude wrote (the weekly-roas-report skill does this).
 *
 *   npx tsx scripts/render-report.ts --client ridgeline-roofing [--narrative narrative.json] [--out reports/manual]
 *
 * narrative.json: { "summary": "...", "wins": [...], "misses": [...], "next_actions": [...] }
 * Numbers always come from the MCP tools; only the words come from the narrative file.
 */
import fs from "node:fs";
import path from "node:path";
import { buildReportData, loadProfile, openPdfRenderer, paths, renderReportHtml, templateNarrative, type Narrative, type WeeklyInputs, type WeeklyReport } from "@arc/core";
import { callJson, connectInProcess } from "@arc/mcp-server";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const clientId = arg("client");
if (!clientId) {
  console.error("Usage: npx tsx scripts/render-report.ts --client <client_id> [--narrative file.json] [--out dir]");
  process.exit(2);
}

const { client, close } = await connectInProcess({ scopes: ["read"], actor: "skill:weekly-roas-report" });
const inputs: WeeklyInputs = {
  current: await callJson(client, "get_campaign_metrics", { client_id: clientId, date_range: "last_7d", include_daily: true }),
  previous: await callJson(client, "get_campaign_metrics", { client_id: clientId, date_range: "prev_7d" }),
  mtd: await callJson(client, "get_mtd_summary", { client_id: clientId }),
  audit: await callJson(client, "audit_account", { client_id: clientId }),
};
await close();

const data = buildReportData(inputs, loadProfile(clientId));
const narrativeFile = arg("narrative");
const narrative: Narrative = narrativeFile ? JSON.parse(fs.readFileSync(narrativeFile, "utf8")) : templateNarrative(data, inputs);
for (const k of ["summary", "wins", "misses", "next_actions"] as const) {
  if (!(k in narrative)) throw new Error(`narrative is missing "${k}"`);
}
const report: WeeklyReport = { ...data, ...narrative, wins: narrative.wins.slice(0, 3), misses: narrative.misses.slice(0, 3), next_actions: narrative.next_actions.slice(0, 4), written_by: narrativeFile ? "Claude (weekly-roas-report skill)" : "template" };

const outDir = arg("out") ?? path.join(paths.reports(), "manual");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${clientId}.pdf`);
const pdf = await openPdfRenderer();
await pdf.render(renderReportHtml(report), out);
await pdf.close();
fs.writeFileSync(path.join(outDir, `${clientId}.json`), JSON.stringify({ report }, null, 2));
console.log(`Wrote ${out}`);
