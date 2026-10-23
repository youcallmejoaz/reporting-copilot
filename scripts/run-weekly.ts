/**
 * Weekly report job: one PDF + one recap email draft per client in reports/YYYY-MM-DD/.
 * Usage: npm run weekly [-- --clients ridgeline-roofing,harbor-law] [--date 2026-10-23]
 * Schedule it with cron (see SETUP.md) or the dashboard's Render cron job.
 */
import { modeLabel } from "@arc/core";
import { runWeekly } from "@arc/agent";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

console.log(`Weekly report job · writer: ${modeLabel()}`);
const result = await runWeekly({
  trigger: "cli",
  reportDate: arg("date"),
  clientIds: arg("clients")?.split(","),
  onProgress: (id, status) => console.log(`  ${id.padEnd(22)} ${status}`),
});
for (const i of result.items) console.log(`${i.status === "done" ? "✓" : "✗"} ${i.client_id}: ${i.pdf_path ?? i.error} (${i.duration_ms}ms)`);
console.log(`${result.status} in ${(result.duration_ms / 1000).toFixed(1)}s → ${result.report_dir}`);
process.exit(result.status === "succeeded" ? 0 : 1);
