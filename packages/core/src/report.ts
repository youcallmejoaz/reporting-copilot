import fs from "node:fs";
import path from "node:path";
import type { auditAccount } from "./audit-rules";
import { generateJson, isLive, modeLabel } from "./claude";
import { fmtMoney, fmtNum, fmtPct, fmtRoas } from "./format";
import { pctChange, type CampaignMetricsResult, type MtdSummary } from "./metrics";
import { paths } from "./paths";
import type { AuditFinding, ClientProfile, Platform, Totals } from "./types";

type AuditResult = Awaited<ReturnType<typeof auditAccount>>;

/** Everything the report needs. The runner fetches these through the MCP server's tools. */
export interface WeeklyInputs {
  current: CampaignMetricsResult & { daily?: ({ date: string } & Totals)[] };
  previous: CampaignMetricsResult;
  mtd: MtdSummary;
  audit: AuditResult;
}

export interface Kpi {
  key: string;
  label: string;
  value: string;
  change_pct: number | null;
  /** Whether the change is good news (null = neutral / no baseline). */
  good: boolean | null;
}

export interface WeeklyReport {
  client_id: string;
  client_name: string;
  brand_as: string;
  period: { start: string; end: string; label: string };
  generated_at: string;
  written_by: string;
  conversion_label: string;
  value_label: string;
  target_roas: number;
  roas: number | null;
  white_label: boolean;
  totals: Totals;
  kpis: Kpi[];
  campaigns: { name: string; platform: Platform; spend: number; conversions: number; roas: number | null; roas_prev: number | null; flag: "red" | "amber" | null }[];
  daily: { date: string; spend: number; revenue: number }[];
  findings: AuditFinding[];
  pacing: MtdSummary["pacing"];
  summary: string;
  wins: string[];
  misses: string[];
  next_actions: string[];
}

export interface Narrative {
  summary: string;
  wins: string[];
  misses: string[];
  next_actions: string[];
}

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    misses: { type: "array", items: { type: "string" } },
    next_actions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "wins", "misses", "next_actions"],
  additionalProperties: false,
};

function kpi(key: string, label: string, value: string, now: number | null, before: number | null, higherIsBetter: boolean | null): Kpi {
  const change = pctChange(now, before);
  return { key, label, value, change_pct: change, good: change === null || higherIsBetter === null || Math.abs(change) < 1 ? null : change > 0 === higherIsBetter };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Deterministic report body: numbers, table, flags. No LLM involved. */
export function buildReportData(inputs: WeeklyInputs, profile: ClientProfile): Omit<WeeklyReport, keyof Narrative | "written_by"> {
  const { current, previous, mtd, audit } = inputs;
  const s = profile.settings;
  const isEcom = s.conversion_label === "purchases";
  const valueLabel = isEcom ? "Revenue" : "Modelled value";
  const t = current.totals;
  const p = previous.totals;
  const flags = new Map<string, "red" | "amber">();
  for (const f of audit.findings) {
    if (!f.campaign_id) continue;
    if (f.severity === "red" || !flags.has(f.campaign_id)) flags.set(f.campaign_id, f.severity);
  }
  const prevById = new Map(previous.campaigns.map((c) => [c.campaign_id, c]));
  return {
    client_id: current.client_id,
    client_name: s.name,
    brand_as: s.brand_as,
    period: { start: current.range.start, end: current.range.end, label: current.range.label },
    generated_at: new Date().toISOString(),
    conversion_label: s.conversion_label,
    value_label: valueLabel,
    target_roas: s.target_roas,
    roas: t.roas,
    white_label: s.white_label,
    totals: t,
    kpis: [
      kpi("roas", `ROAS (target ${s.target_roas.toFixed(1)})`, fmtRoas(t.roas), t.roas, p.roas, true),
      kpi("spend", "Spend", fmtMoney(t.spend), t.spend, p.spend, null),
      kpi("revenue", valueLabel, fmtMoney(t.revenue), t.revenue, p.revenue, true),
      kpi("conversions", cap(s.conversion_label), fmtNum(t.conversions), t.conversions, p.conversions, true),
      kpi("cpa", `Cost per ${isEcom ? "purchase" : s.conversion_label.replace(/s$/, "").split(" ").pop()}`, fmtMoney(t.cpa, 2), t.cpa, p.cpa, false),
      kpi("ctr", "CTR", `${t.ctr.toFixed(2)}%`, t.ctr, p.ctr, true),
    ],
    campaigns: current.campaigns.map((c) => ({
      name: c.name,
      platform: c.platform,
      spend: c.totals.spend,
      conversions: c.totals.conversions,
      roas: c.totals.roas,
      roas_prev: prevById.get(c.campaign_id)?.totals.roas ?? null,
      flag: flags.get(c.campaign_id) ?? null,
    })),
    daily: (current.daily ?? []).map((d) => ({ date: d.date, spend: d.spend, revenue: d.revenue })),
    findings: audit.findings,
    pacing: mtd.pacing,
  };
}

/** Test-mode narrative: rule-based bullets built only from the report data. */
export function templateNarrative(r: Omit<WeeklyReport, keyof Narrative | "written_by">, inputs: WeeklyInputs): Narrative {
  const target = r.target_roas;
  const t = inputs.current.totals;
  const p = inputs.previous.totals;
  const roasChange = pctChange(t.roas, p.roas);
  const flaggedIds = new Set(r.findings.map((f) => f.entity_id));
  const wins: string[] = [];
  const misses: string[] = [];
  const actions: string[] = [];

  const strong = inputs.current.campaigns
    .filter((c) => (c.totals.roas ?? 0) >= target && c.totals.conversions > 0 && !flaggedIds.has(c.campaign_id))
    .sort((a, b) => b.totals.revenue - a.totals.revenue);
  if (roasChange !== null && roasChange >= 3) wins.push(`Blended ROAS up ${Math.abs(roasChange).toFixed(1)}% week over week to ${fmtRoas(t.roas)}.`);
  for (const c of strong.slice(0, 3 - wins.length)) {
    wins.push(`${c.name} returned ${fmtRoas(c.totals.roas)} ROAS on ${fmtMoney(c.totals.spend)} spend (${c.totals.conversions} ${r.conversion_label}).`);
  }

  for (const f of r.findings.filter((f) => f.severity === "red")) misses.push(`${f.entity_name}: ${f.reason}`);
  if (roasChange !== null && roasChange <= -3 && misses.length < 3) misses.push(`Blended ROAS down ${Math.abs(roasChange).toFixed(1)}% week over week to ${fmtRoas(t.roas)}.`);
  const weak = inputs.current.campaigns
    .filter((c) => c.totals.spend > 0 && (c.totals.roas ?? 0) < target && !r.findings.some((f) => f.entity_id === c.campaign_id && f.severity === "red"))
    .sort((a, b) => (a.totals.roas ?? 0) - (b.totals.roas ?? 0));
  for (const c of weak) {
    if (misses.length >= 3) break;
    misses.push(`${c.name} is below target at ${fmtRoas(c.totals.roas)} ROAS on ${fmtMoney(c.totals.spend)} spend.`);
  }
  for (const f of r.findings.filter((f) => f.severity === "amber")) {
    if (misses.length >= 3) break;
    misses.push(`${f.entity_name}: ${f.reason}`);
  }
  if (misses.length === 0) misses.push("No campaigns below target this week.");
  if (wins.length === 0) wins.push(`Spend held at ${fmtMoney(t.spend)} with ${t.conversions} ${r.conversion_label}.`);

  // One action per recommendation, naming every entity it applies to.
  const byRec = new Map<string, string[]>();
  for (const f of r.findings) byRec.set(f.recommendation, [...(byRec.get(f.recommendation) ?? []), f.entity_name]);
  for (const [rec, names] of byRec) {
    if (actions.length >= 3) break;
    actions.push(`${rec.replace(/\.$/, "")}: ${names.join(", ")}.`);
  }
  if (strong[0] && weak[0] && actions.length < 4) actions.push(`Shift budget from ${weak[0].name} toward ${strong[0].name}.`);
  if (actions.length < 4 && r.findings.some((f) => f.rule === "low_ctr" || f.rule === "roas_below_1")) {
    actions.push("Creative refreshes are drafted and left paused for approval before anything goes live.");
  }
  if (actions.length === 0) actions.push("Keep budgets steady and test one new creative angle on the top campaign.");

  const roasVsTarget = t.roas === null ? "" : t.roas >= target ? `above the ${target.toFixed(1)} target` : `below the ${target.toFixed(1)} target`;
  const summary =
    `${r.period.label} (${r.period.start} to ${r.period.end}): ${fmtMoney(t.spend)} spend produced ${t.conversions} ${r.conversion_label} ` +
    `and ${fmtMoney(t.revenue)} ${r.value_label.toLowerCase()}, a ${fmtRoas(t.roas)} ROAS ${roasVsTarget}` +
    `${roasChange === null ? "." : ` (${fmtPct(roasChange)} vs the previous week).`} ` +
    `Month to date the account is pacing to ${r.pacing.projected_pct_of_budget}% of its ${fmtMoney(r.pacing.monthly_budget)} budget.`;

  return { summary, wins: wins.slice(0, 3), misses: misses.slice(0, 3), next_actions: actions.slice(0, 4) };
}

function promptFile(name: string): string {
  return fs.readFileSync(path.join(paths.prompts(), name), "utf8");
}

export async function writeWeeklyReport(inputs: WeeklyInputs, profile: ClientProfile): Promise<WeeklyReport> {
  const data = buildReportData(inputs, profile);
  let narrative: Narrative;
  if (isLive()) {
    narrative = await generateJson<Narrative>({
      system: promptFile("weekly-report.md"),
      prompt: `<knowledge_profile>\n${profile.raw}\n</knowledge_profile>\n\n<report_data>\n${JSON.stringify({ ...data, previous_week_totals: inputs.previous.totals, current_week_totals: inputs.current.totals }, null, 2)}\n</report_data>`,
      schema: NARRATIVE_SCHEMA,
    });
    narrative = { ...narrative, wins: narrative.wins.slice(0, 3), misses: narrative.misses.slice(0, 3), next_actions: narrative.next_actions.slice(0, 4) };
  } else {
    narrative = templateNarrative(data, inputs);
  }
  return { ...data, ...narrative, written_by: modeLabel() };
}
