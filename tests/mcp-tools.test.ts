import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { listAuditLog, type DraftAd, type MtdSummary } from "@arc/core";
import { callJson, connectInProcess, DRAFT_TOOLS, READ_TOOLS } from "@arc/mcp-server";

describe("MCP tools (in-process)", () => {
  let conn: Awaited<ReturnType<typeof connectInProcess>>;
  beforeAll(async () => {
    conn = await connectInProcess({ scopes: ["read", "draft"], actor: "test" });
  });
  afterAll(async () => conn.close());

  it("exposes the read and draft tools", async () => {
    const names = (await conn.client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...READ_TOOLS, ...DRAFT_TOOLS].sort());
  });

  it("has no tool that can activate, publish, approve or change budgets/status", async () => {
    const tools = (await conn.client.listTools()).tools;
    for (const t of tools) {
      expect(t.name).not.toMatch(/approve|activate|publish|enable|status|budget|delete|update|pause/i);
      // Write tools cannot take a status or budget argument (read tools may filter by status).
      if (!t.annotations?.readOnlyHint) {
        expect(Object.keys((t.inputSchema as { properties?: object }).properties ?? {})).toEqual(["client_id", "campaign_id"]);
      }
    }
  });

  it("list_clients returns the four sample clients", async () => {
    const r = await callJson<{ clients: { client_id: string }[] }>(conn.client, "list_clients", {});
    expect(r.clients.map((c) => c.client_id).sort()).toEqual(["glowfield-skincare", "harbor-law", "northstar-partners", "ridgeline-roofing"]);
  });

  it("get_mtd_summary answers 'how did the roofing client do this month' with real numbers", async () => {
    const r = await callJson<MtdSummary>(conn.client, "get_mtd_summary", { client_id: "ridgeline-roofing" });
    expect(r.client_name).toBe("Ridgeline Roofing Co.");
    expect(r.range).toMatchObject({ start: "2026-10-01", end: "2026-10-22" });
    expect(r.totals.spend).toBeGreaterThan(0);
    expect(r.totals.conversions).toBeGreaterThan(0);
    expect(r.pacing.monthly_budget).toBe(11000);
  });

  it("get_campaign_metrics supports presets, explicit ranges and daily series", async () => {
    const r = await callJson<{ campaigns: unknown[]; daily: unknown[] }>(conn.client, "get_campaign_metrics", { client_id: "harbor-law", date_range: "last_7d", include_daily: true });
    expect(r.campaigns).toHaveLength(4);
    expect(r.daily).toHaveLength(7);
    const e = await callJson<{ range: { start: string } }>(conn.client, "get_campaign_metrics", { client_id: "harbor-law", date_range: "2026-09-01..2026-09-30" });
    expect(e.range.start).toBe("2026-09-01");
  });

  it("find_underperformers defaults to the client's target and finds the ROAS < 1 campaign", async () => {
    const r = await callJson<{ roas_threshold: number; underperformers: { name: string; roas: number }[] }>(conn.client, "find_underperformers", { client_id: "glowfield-skincare" });
    expect(r.roas_threshold).toBe(3);
    expect(r.underperformers[0].name).toBe("GF_META_PROS_BroadVideo");
    expect(r.underperformers[0].roas).toBeLessThan(1);
  });

  it("audit_account returns red and amber findings", async () => {
    const r = await callJson<{ findings: { severity: string }[] }>(conn.client, "audit_account", { client_id: "harbor-law" });
    expect(r.findings.filter((f) => f.severity === "red")).toHaveLength(2);
  });

  it("draft_ad_refresh always creates a PAUSED draft", async () => {
    const d = await callJson<DraftAd>(conn.client, "draft_ad_refresh", { client_id: "northstar-partners", campaign_id: "cmp_np_01" });
    expect(d.status).toBe("PAUSED");
    expect(d.replaces_ad_id).toBe("ad_np_01a1"); // the low-CTR creative
    expect(d.name).toBe("Static_Offer_v2");
  });

  it("serves the client knowledge profile as a resource", async () => {
    const res = await conn.client.readResource({ uri: "client://ridgeline-roofing/profile" });
    const text = (res.contents[0] as { text: string }).text;
    expect(text).toContain("# Ridgeline Roofing Co.");
    expect(text).toContain("Naming convention");
  });

  it("returns a tool error (not a crash) for bad input, and logs it", async () => {
    const res = await conn.client.callTool({ name: "get_mtd_summary", arguments: { client_id: "nope" } });
    expect(res.isError).toBe(true);
    expect(listAuditLog({ limit: 1 })[0]).toMatchObject({ action: "get_mtd_summary", result: "error", actor: "test" });
  });

  it("writes an audit log row for every tool call", async () => {
    const before = listAuditLog({ limit: 1 })[0]?.id ?? 0;
    await conn.client.callTool({ name: "list_clients", arguments: {} });
    await conn.client.callTool({ name: "audit_account", arguments: { client_id: "ridgeline-roofing" } });
    const rows = listAuditLog({ afterId: before }).reverse();
    expect(rows.map((r) => [r.action, r.scope, r.result])).toEqual([
      ["list_clients", "read", "ok"],
      ["audit_account", "read", "ok"],
    ]);
    expect(rows[1].client_id).toBe("ridgeline-roofing");
  });
});

describe("tool scopes", () => {
  it("read-only scope does not expose draft tools", async () => {
    const conn = await connectInProcess({ scopes: ["read"], actor: "test" });
    const names = (await conn.client.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("draft_ad_refresh");
    const res = await conn.client.callTool({ name: "draft_ad_refresh", arguments: { client_id: "harbor-law", campaign_id: "cmp_hl_01" } });
    expect(res.isError).toBe(true);
    await conn.close();
  });

  it("draft-only scope exposes no read tools", async () => {
    const conn = await connectInProcess({ scopes: ["draft"], actor: "test" });
    expect((await conn.client.listTools()).tools.map((t) => t.name)).toEqual(["draft_ad_refresh"]);
    await conn.close();
  });
});

describe("stdio server (what Claude Desktop / Claude Code launch)", () => {
  it("starts, lists tools and answers a question over stdio", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), path.join(process.cwd(), "packages", "mcp-server", "src", "index.ts")],
      env: { ...(process.env as Record<string, string>), MCP_SCOPES: "read" },
      stderr: "ignore",
    });
    const client = new Client({ name: "stdio-test", version: "0" });
    await client.connect(transport);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("get_mtd_summary");
    expect(names).not.toContain("draft_ad_refresh");
    const r = await callJson<MtdSummary>(client, "get_mtd_summary", { client_id: "ridgeline-roofing" });
    expect(r.totals.spend).toBeGreaterThan(0);
    await client.close();
  });
});
