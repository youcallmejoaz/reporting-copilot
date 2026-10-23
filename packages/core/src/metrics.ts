import { getAdapter } from "./adapters/index.js";
import { addDays, daysBetween, daysInMonth, monthStart, resolveRange } from "./dates.js";
import { asOfDate } from "./paths.js";
import { loadProfile } from "./profiles.js";
import type { Campaign, DailyMetric, DateRange, Platform, Totals } from "./types.js";

const r2 = (x: number) => Math.round(x * 100) / 100;

export function aggregate(rows: Pick<DailyMetric, "impressions" | "clicks" | "spend" | "conversions" | "revenue">[]): Totals {
  const t = rows.reduce(
    (a, m) => {
      a.impressions += m.impressions;
      a.clicks += m.clicks;
      a.spend += m.spend;
      a.conversions += m.conversions;
      a.revenue += m.revenue;
      return a;
    },
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 },
  );
  return {
    impressions: t.impressions,
    clicks: t.clicks,
    spend: r2(t.spend),
    conversions: t.conversions,
    revenue: r2(t.revenue),
    ctr: t.impressions ? r2((t.clicks / t.impressions) * 100) : 0,
    cpc: t.clicks ? r2(t.spend / t.clicks) : 0,
    cpa: t.conversions ? r2(t.spend / t.conversions) : null,
    roas: t.spend ? r2(t.revenue / t.spend) : null,
    cvr: t.clicks ? r2((t.conversions / t.clicks) * 100) : 0,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/** Percentage change, rounded to 1 decimal. Null when there is no baseline. */
export function pctChange(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}

export interface CampaignMetrics {
  campaign_id: string;
  name: string;
  platform: Platform;
  objective: string;
  totals: Totals;
}

export interface CampaignMetricsResult {
  client_id: string;
  client_name: string;
  range: DateRange;
  target_roas: number;
  totals: Totals;
  by_platform: Record<string, Totals>;
  campaigns: CampaignMetrics[];
}

export async function getCampaignMetrics(clientId: string, dateRange = "last_7d", asOf = asOfDate()): Promise<CampaignMetricsResult> {
  const adapter = getAdapter();
  const client = await adapter.getClient(clientId);
  const profile = loadProfile(clientId);
  const range = resolveRange(dateRange, asOf);
  const [rows, campaigns] = await Promise.all([adapter.getDailyMetrics(clientId, range.start, range.end), adapter.listCampaigns(clientId)]);
  const byCampaign = groupBy(rows, (r) => r.campaign_id);
  const byPlatform = groupBy(rows, (r) => r.platform);
  return {
    client_id: client.id,
    client_name: client.name,
    range,
    target_roas: profile.settings.target_roas,
    totals: aggregate(rows),
    by_platform: Object.fromEntries([...byPlatform].map(([p, list]) => [p, aggregate(list)])),
    campaigns: campaigns
      .map((c: Campaign) => ({
        campaign_id: c.id,
        name: c.name,
        platform: c.platform,
        objective: c.objective,
        totals: aggregate(byCampaign.get(c.id) ?? []),
      }))
      .sort((a, b) => b.totals.spend - a.totals.spend),
  };
}

export interface MtdSummary {
  client_id: string;
  client_name: string;
  as_of: string;
  range: DateRange;
  conversion_label: string;
  target_roas: number;
  totals: Totals;
  previous_month_same_period: { range: DateRange; totals: Totals };
  change_vs_previous_pct: { spend: number | null; revenue: number | null; conversions: number | null; roas: number | null; cpa: number | null };
  pacing: {
    monthly_budget: number;
    spend_mtd: number;
    expected_spend_by_now: number;
    projected_month_spend: number;
    projected_pct_of_budget: number;
    days_elapsed: number;
    days_in_month: number;
  };
  top_campaigns: { name: string; platform: Platform; spend: number; roas: number | null; conversions: number }[];
  bottom_campaigns: { name: string; platform: Platform; spend: number; roas: number | null; conversions: number }[];
}

export async function getMtdSummary(clientId: string, asOf = asOfDate()): Promise<MtdSummary> {
  const profile = loadProfile(clientId);
  const now = await getCampaignMetrics(clientId, "mtd", asOf);
  const daysElapsed = daysBetween(now.range.start, asOf);
  const prevStart = monthStart(addDays(monthStart(asOf), -1));
  const prevEnd = addDays(prevStart, Math.min(daysElapsed, daysInMonth(prevStart)) - 1);
  const prev = await getCampaignMetrics(clientId, `${prevStart}..${prevEnd}`, asOf);
  const dim = daysInMonth(asOf);
  const budget = profile.settings.monthly_budget;
  const projected = r2((now.totals.spend / daysElapsed) * dim);
  const ranked = now.campaigns
    .filter((c) => c.totals.spend > 0)
    .map((c) => ({ name: c.name, platform: c.platform, spend: c.totals.spend, roas: c.totals.roas, conversions: c.totals.conversions }))
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  return {
    client_id: clientId,
    client_name: now.client_name,
    as_of: asOf,
    range: now.range,
    conversion_label: profile.settings.conversion_label,
    target_roas: profile.settings.target_roas,
    totals: now.totals,
    previous_month_same_period: { range: prev.range, totals: prev.totals },
    change_vs_previous_pct: {
      spend: pctChange(now.totals.spend, prev.totals.spend),
      revenue: pctChange(now.totals.revenue, prev.totals.revenue),
      conversions: pctChange(now.totals.conversions, prev.totals.conversions),
      roas: pctChange(now.totals.roas, prev.totals.roas),
      cpa: pctChange(now.totals.cpa, prev.totals.cpa),
    },
    pacing: {
      monthly_budget: budget,
      spend_mtd: now.totals.spend,
      expected_spend_by_now: r2((budget / dim) * daysElapsed),
      projected_month_spend: projected,
      projected_pct_of_budget: Math.round((projected / budget) * 1000) / 10,
      days_elapsed: daysElapsed,
      days_in_month: dim,
    },
    top_campaigns: ranked.slice(0, 3),
    bottom_campaigns: ranked.slice(-3).reverse(),
  };
}

export interface Underperformer {
  campaign_id: string;
  name: string;
  platform: Platform;
  spend: number;
  revenue: number;
  conversions: number;
  roas: number | null;
  shortfall_vs_threshold: number;
}

export async function findUnderperformers(
  clientId: string,
  roasThreshold?: number,
  dateRange = "last_14d",
  asOf = asOfDate(),
): Promise<{ client_id: string; range: DateRange; roas_threshold: number; underperformers: Underperformer[] }> {
  const m = await getCampaignMetrics(clientId, dateRange, asOf);
  const threshold = roasThreshold ?? m.target_roas;
  const underperformers = m.campaigns
    .filter((c) => c.totals.spend > 0 && (c.totals.roas ?? 0) < threshold)
    .map((c) => ({
      campaign_id: c.campaign_id,
      name: c.name,
      platform: c.platform,
      spend: c.totals.spend,
      revenue: c.totals.revenue,
      conversions: c.totals.conversions,
      roas: c.totals.roas,
      shortfall_vs_threshold: r2(threshold - (c.totals.roas ?? 0)),
    }))
    .sort((a, b) => (a.roas ?? 0) - (b.roas ?? 0));
  return { client_id: clientId, range: m.range, roas_threshold: threshold, underperformers };
}

/** Daily totals for charts. */
export async function getDailySeries(clientId: string, dateRange = "last_14d", asOf = asOfDate()) {
  const range = resolveRange(dateRange, asOf);
  const rows = await getAdapter().getDailyMetrics(clientId, range.start, range.end);
  return [...groupBy(rows, (r) => r.date)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, ...aggregate(list) }));
}

export { groupBy };
