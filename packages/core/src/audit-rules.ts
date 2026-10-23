import { getAdapter } from "./adapters/index.js";
import { resolveRange } from "./dates.js";
import { aggregate, getMtdSummary, groupBy } from "./metrics.js";
import { asOfDate } from "./paths.js";
import { loadProfile } from "./profiles.js";
import type { AuditFinding } from "./types.js";

/** Thresholds, in one place so the audit skill and the docs can quote them. */
export const AUDIT_RULES = {
  window: "last_14d",
  roas_below_1: { min_spend: 100 },
  wasted_spend: { min_spend: 300 },
  overspend: { window: "last_7d", max_ratio: 1.2 },
  low_ctr: { max_ctr_pct: 0.5, min_impressions: 5000 },
  budget_pacing: { over_pct: 110, under_pct: 85 },
} as const;

const money = (x: number) => `$${x.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/**
 * Deterministic account audit. Rules:
 *  - roas_below_1   (red)   campaign ROAS < 1.0 over the last 14 days (with meaningful spend)
 *  - wasted_spend   (red)   campaign spent >= $300 in the last 14 days with zero conversions
 *  - overspend      (red)   ad set average daily spend > 120% of its daily budget over the last 7 days
 *  - broken_naming  (amber) campaign name does not match the client's naming_pattern
 *  - low_ctr        (amber) ad CTR < 0.5% on >= 5,000 impressions over the last 14 days
 *  - budget_pacing  (amber) projected month spend > 110% or < 85% of the monthly budget
 */
export async function auditAccount(clientId: string, asOf = asOfDate()): Promise<{ client_id: string; as_of: string; findings: AuditFinding[]; rules: typeof AUDIT_RULES }> {
  const adapter = getAdapter();
  const profile = loadProfile(clientId);
  const [campaigns, adSets, ads] = await Promise.all([adapter.listCampaigns(clientId), adapter.listAdSets(clientId), adapter.listAds(clientId)]);
  const w14 = resolveRange(AUDIT_RULES.window, asOf);
  const w7 = resolveRange(AUDIT_RULES.overspend.window, asOf);
  const rows14 = await adapter.getDailyMetrics(clientId, w14.start, w14.end);
  const rows7 = rows14.filter((r) => r.date >= w7.start);
  const findings: AuditFinding[] = [];

  const byCampaign = groupBy(rows14, (r) => r.campaign_id);
  const pattern = new RegExp(profile.settings.naming_pattern);
  for (const c of campaigns) {
    const t = aggregate(byCampaign.get(c.id) ?? []);
    if (t.spend >= AUDIT_RULES.wasted_spend.min_spend && t.conversions === 0) {
      findings.push({
        rule: "wasted_spend",
        severity: "red",
        entity_type: "campaign",
        entity_id: c.id,
        campaign_id: c.id,
        entity_name: c.name,
        reason: `${money(t.spend)} spent in the last 14 days with zero ${profile.settings.conversion_label}.`,
        recommendation: "Pause the campaign and move the budget to the best performing campaign.",
        metric: { spend: t.spend, conversions: 0 },
      });
    } else if (t.spend >= AUDIT_RULES.roas_below_1.min_spend && t.roas !== null && t.roas < 1) {
      findings.push({
        rule: "roas_below_1",
        severity: "red",
        entity_type: "campaign",
        entity_id: c.id,
        campaign_id: c.id,
        entity_name: c.name,
        reason: `ROAS ${t.roas.toFixed(2)} over the last 14 days: every $1 spent returned $${t.roas.toFixed(2)} (${money(t.spend)} spend, ${money(t.revenue)} revenue).`,
        recommendation: "Cut budget 50% and refresh creative, or pause if it does not recover within 7 days.",
        metric: { roas: t.roas, spend: t.spend, revenue: t.revenue },
      });
    }
    if (!pattern.test(c.name)) {
      findings.push({
        rule: "broken_naming",
        severity: "amber",
        entity_type: "campaign",
        entity_id: c.id,
        campaign_id: c.id,
        entity_name: c.name,
        reason: `"${c.name}" does not follow the naming convention (${profile.settings.naming_pattern}).`,
        recommendation: "Rename to the client's convention so reports and filters pick it up.",
      });
    }
  }

  const byAdSet = groupBy(rows7, (r) => r.ad_set_id);
  const days7 = new Set(rows7.map((r) => r.date)).size || 1;
  for (const s of adSets) {
    const spend = aggregate(byAdSet.get(s.id) ?? []).spend;
    const avg = spend / days7;
    const ratio = avg / s.daily_budget;
    if (ratio > AUDIT_RULES.overspend.max_ratio) {
      const campaign = campaigns.find((c) => c.id === s.campaign_id);
      findings.push({
        rule: "overspend",
        severity: "red",
        entity_type: "ad_set",
        entity_id: s.id,
        campaign_id: s.campaign_id,
        entity_name: `${campaign?.name ?? s.campaign_id} › ${s.name}`,
        reason: `Averaging ${money(avg)}/day against a ${money(s.daily_budget)}/day budget (${Math.round(ratio * 100)}%) over the last 7 days.`,
        recommendation: "Check for a budget edit or a missing spend cap; bring it back to budget.",
        metric: { avg_daily_spend: Math.round(avg * 100) / 100, daily_budget: s.daily_budget, ratio_pct: Math.round(ratio * 100) },
      });
    }
  }

  const byAd = groupBy(rows14, (r) => r.ad_id);
  for (const a of ads) {
    const t = aggregate(byAd.get(a.id) ?? []);
    if (t.impressions >= AUDIT_RULES.low_ctr.min_impressions && t.ctr < AUDIT_RULES.low_ctr.max_ctr_pct) {
      findings.push({
        rule: "low_ctr",
        severity: "amber",
        entity_type: "ad",
        entity_id: a.id,
        campaign_id: adSets.find((s) => s.id === a.ad_set_id)?.campaign_id,
        entity_name: a.name,
        reason: `CTR ${t.ctr.toFixed(2)}% on ${t.impressions.toLocaleString("en-US")} impressions in the last 14 days (threshold ${AUDIT_RULES.low_ctr.max_ctr_pct}%).`,
        recommendation: "Draft a creative refresh (left paused for review) and rotate this ad out.",
        metric: { ctr: t.ctr, impressions: t.impressions },
      });
    }
  }

  const mtd = await getMtdSummary(clientId, asOf);
  const pct = mtd.pacing.projected_pct_of_budget;
  if (pct > AUDIT_RULES.budget_pacing.over_pct || pct < AUDIT_RULES.budget_pacing.under_pct) {
    findings.push({
      rule: "budget_pacing",
      severity: "amber",
      entity_type: "account",
      entity_id: clientId,
      entity_name: profile.settings.name,
      reason: `Projected month spend ${money(mtd.pacing.projected_month_spend)} is ${pct}% of the ${money(mtd.pacing.monthly_budget)} budget.`,
      recommendation: pct > 100 ? "Trim daily budgets to land on the monthly budget." : "Raise budgets on the best campaigns or confirm the underspend with the client.",
      metric: { projected_pct_of_budget: pct },
    });
  }

  const order = { red: 0, amber: 1 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { client_id: clientId, as_of: asOf, findings, rules: AUDIT_RULES };
}
