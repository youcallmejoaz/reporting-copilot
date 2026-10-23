import { describe, expect, it } from "vitest";
import { aggregate, getCampaignMetrics, getMtdSummary, pctChange, resolveRange } from "@arc/core";
import { metricsRows } from "./helpers";

describe("date ranges", () => {
  it("resolves presets relative to the as-of date", () => {
    expect(resolveRange("last_7d", "2026-10-22")).toMatchObject({ start: "2026-10-16", end: "2026-10-22" });
    expect(resolveRange("prev_7d", "2026-10-22")).toMatchObject({ start: "2026-10-09", end: "2026-10-15" });
    expect(resolveRange("mtd", "2026-10-22")).toMatchObject({ start: "2026-10-01", end: "2026-10-22" });
    expect(resolveRange("last_month", "2026-10-22")).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
    expect(resolveRange("2026-09-01..2026-09-07", "2026-10-22")).toMatchObject({ start: "2026-09-01", end: "2026-09-07" });
  });
  it("rejects unknown and reversed ranges", () => {
    expect(() => resolveRange("yesterday-ish", "2026-10-22")).toThrow(/Unknown date range/);
    expect(() => resolveRange("2026-10-07..2026-10-01", "2026-10-22")).toThrow(/start is after end/);
  });
});

describe("metrics", () => {
  it("roofing month-to-date totals match the raw sample data", async () => {
    const rows = metricsRows().filter((m) => m.client_id === "ridgeline-roofing" && m.date >= "2026-10-01" && m.date <= "2026-10-22");
    const expected = aggregate(rows);
    const mtd = await getMtdSummary("ridgeline-roofing");
    expect(mtd.range).toMatchObject({ start: "2026-10-01", end: "2026-10-22" });
    expect(mtd.totals).toEqual(expected);
    expect(mtd.totals.spend).toBeGreaterThan(5000);
    expect(mtd.pacing.days_elapsed).toBe(22);
    expect(mtd.pacing.days_in_month).toBe(31);
    expect(mtd.pacing.projected_month_spend).toBeCloseTo((expected.spend / 22) * 31, 0);
  });

  it("campaign rows add up to the account total", async () => {
    const m = await getCampaignMetrics("glowfield-skincare", "last_30d");
    const spend = m.campaigns.reduce((a, c) => a + c.totals.spend, 0);
    expect(spend).toBeCloseTo(m.totals.spend, 1);
    expect(Object.keys(m.by_platform).sort()).toEqual(["google", "meta"]);
  });

  it("computes ratios safely", () => {
    expect(aggregate([])).toMatchObject({ spend: 0, roas: null, cpa: null, ctr: 0 });
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(5, 0)).toBeNull();
  });

  it("errors clearly for an unknown client", async () => {
    await expect(getMtdSummary("acme")).rejects.toThrow(/No knowledge profile|Unknown client_id/);
  });
});
