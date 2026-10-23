import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AUDIT_RULES,
  asOfDate,
  auditAccount,
  createPausedDraft,
  findUnderperformers,
  getAdapter,
  getCampaignMetrics,
  getDailySeries,
  getMtdSummary,
  listDrafts,
  listProfileIds,
  loadProfile,
  logAction,
  planAdRefresh,
  PRESETS,
  type Actor,
} from "@arc/core";

export type ToolScope = "read" | "draft";

export interface ServerOptions {
  /** Which tool groups to expose. Defaults to MCP_SCOPES env, else read + draft. */
  scopes?: ToolScope[];
  /** Recorded in the audit log for every call. */
  actor?: Actor;
}

export const READ_TOOLS = ["list_clients", "get_campaign_metrics", "get_mtd_summary", "find_underperformers", "audit_account", "list_draft_ads"] as const;
export const DRAFT_TOOLS = ["draft_ad_refresh"] as const;

export function scopesFromEnv(): ToolScope[] {
  const raw = (process.env.MCP_SCOPES ?? "read,draft").split(",").map((s) => s.trim()).filter(Boolean);
  const bad = raw.filter((s) => s !== "read" && s !== "draft");
  if (bad.length) throw new Error(`Unknown MCP_SCOPES value(s): ${bad.join(", ")} (allowed: read, draft)`);
  return raw as ToolScope[];
}

type Content = { content: { type: "text"; text: string }[]; isError?: boolean };

function jsonResult(summary: string, data: unknown): Content {
  return { content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(data, null, 2)}` }] };
}

const clientId = z.string().describe("Client id from list_clients, e.g. ridgeline-roofing");
const dateRange = z
  .string()
  .default("last_7d")
  .describe(`One of ${PRESETS.join(", ")}, or an explicit range YYYY-MM-DD..YYYY-MM-DD. Relative ranges end on the data's as-of date.`);

/**
 * Build the Ads Data MCP server.
 * Read tools and draft tools are separate scopes. No tool can activate an ad, change a budget or change a status:
 * the only write (draft_ad_refresh) creates a PAUSED ad that a human must approve in the dashboard.
 */
export function createServer(opts: ServerOptions = {}): McpServer {
  const scopes = new Set(opts.scopes ?? scopesFromEnv());
  const actor = opts.actor ?? "mcp";
  const server = new McpServer(
    { name: "ads-data", version: "0.1.0" },
    {
      instructions:
        `Ads data for a paid media agency's client accounts (Meta + Google). Data runs to ${asOfDate()}; "this month" means month to date as of that day. ` +
        "Read each client's knowledge profile resource (client://<id>/profile) for targets, naming conventions and tone before writing anything client-facing. " +
        "draft_ad_refresh only creates PAUSED drafts that a human approves in the dashboard; never tell the user an ad is live.",
    },
  );

  /** Wrap a handler with audit logging and uniform error results. */
  function tool<A extends Record<string, unknown>>(name: string, scope: ToolScope, run: (args: A) => Promise<Content>) {
    return async (args: A): Promise<Content> => {
      const cid = typeof args.client_id === "string" ? args.client_id : null;
      if (!scopes.has(scope)) {
        logAction({ actor, action: name, scope, client_id: cid, args, result: "denied", detail: `scope "${scope}" not enabled` });
        return { content: [{ type: "text", text: `Tool ${name} needs the "${scope}" scope, which is not enabled.` }], isError: true };
      }
      try {
        const out = await run(args);
        logAction({ actor, action: name, scope, client_id: cid, args, result: "ok", detail: out.content[0]?.text.split("\n")[0] });
        return out;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logAction({ actor, action: name, scope, client_id: cid, args, result: "error", detail: message });
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    };
  }

  if (scopes.has("read")) {
    server.registerTool(
      "list_clients",
      { title: "List clients", description: "List every client account with platforms, ROAS target and monthly budget.", inputSchema: {}, annotations: { readOnlyHint: true } },
      tool("list_clients", "read", async () => {
        const clients = await getAdapter().listClients();
        const rows = clients.map((c) => {
          const s = loadProfile(c.id).settings;
          return { client_id: c.id, name: c.name, vertical: c.vertical, platforms: c.platforms, target_roas: s.target_roas, monthly_budget: s.monthly_budget, conversion_label: s.conversion_label };
        });
        return jsonResult(`${rows.length} clients`, { as_of: asOfDate(), clients: rows });
      }),
    );

    server.registerTool(
      "get_campaign_metrics",
      {
        title: "Campaign metrics",
        description: "Spend, revenue (or modelled lead value), conversions, ROAS, CPA, CTR for a client over a date range: account totals, per platform and per campaign. Set include_daily for a day-by-day series.",
        inputSchema: { client_id: clientId, date_range: dateRange, include_daily: z.boolean().default(false).describe("Add daily account totals") },
        annotations: { readOnlyHint: true },
      },
      tool("get_campaign_metrics", "read", async (a: { client_id: string; date_range: string; include_daily: boolean }) => {
        const m = await getCampaignMetrics(a.client_id, a.date_range);
        const data = a.include_daily ? { ...m, daily: await getDailySeries(a.client_id, a.date_range) } : m;
        return jsonResult(`${m.client_name} · ${m.range.start}..${m.range.end} · spend $${m.totals.spend} · ROAS ${m.totals.roas}`, data);
      }),
    );

    server.registerTool(
      "get_mtd_summary",
      {
        title: "Month-to-date summary",
        description: "Month-to-date totals for a client vs the same days last month, budget pacing, and top/bottom campaigns. Use this for 'how did <client> do this month?'.",
        inputSchema: { client_id: clientId },
        annotations: { readOnlyHint: true },
      },
      tool("get_mtd_summary", "read", async (a: { client_id: string }) => {
        const m = await getMtdSummary(a.client_id);
        return jsonResult(`${m.client_name} MTD ${m.range.start}..${m.range.end} · spend $${m.totals.spend} · ROAS ${m.totals.roas}`, m);
      }),
    );

    server.registerTool(
      "find_underperformers",
      {
        title: "Find underperforming campaigns",
        description: "Campaigns whose ROAS is below a threshold over a date range (default: the client's target ROAS, last 14 days), worst first.",
        inputSchema: {
          client_id: clientId,
          roas_threshold: z.number().positive().optional().describe("Defaults to the client's target ROAS from its profile"),
          date_range: dateRange.default("last_14d"),
        },
        annotations: { readOnlyHint: true },
      },
      tool("find_underperformers", "read", async (a: { client_id: string; roas_threshold?: number; date_range: string }) => {
        const r = await findUnderperformers(a.client_id, a.roas_threshold, a.date_range);
        return jsonResult(`${r.underperformers.length} campaign(s) below ROAS ${r.roas_threshold}`, r);
      }),
    );

    server.registerTool(
      "audit_account",
      {
        title: "Audit account",
        description:
          "Deterministic account audit: ROAS under 1, wasted spend (no conversions), ad sets overspending their budget, campaign names that break the client's naming convention, low CTR creatives and monthly budget pacing. Red = fix now, amber = check.",
        inputSchema: { client_id: clientId },
        annotations: { readOnlyHint: true },
      },
      tool("audit_account", "read", async (a: { client_id: string }) => {
        const r = await auditAccount(a.client_id);
        const red = r.findings.filter((f) => f.severity === "red").length;
        return jsonResult(`${r.findings.length} finding(s): ${red} red, ${r.findings.length - red} amber`, r);
      }),
    );

    server.registerTool(
      "list_draft_ads",
      {
        title: "List draft ads",
        description: "Draft ad refreshes and their approval status (PAUSED = waiting for human review, APPROVED, REJECTED).",
        inputSchema: { client_id: clientId.optional(), status: z.enum(["PAUSED", "APPROVED", "REJECTED"]).optional() },
        annotations: { readOnlyHint: true },
      },
      tool("list_draft_ads", "read", async (a: { client_id?: string; status?: "PAUSED" | "APPROVED" | "REJECTED" }) => {
        const drafts = listDrafts({ clientId: a.client_id, status: a.status });
        return jsonResult(`${drafts.length} draft(s)`, drafts);
      }),
    );

    server.registerResource(
      "client-profile",
      new ResourceTemplate("client://{client_id}/profile", {
        list: async () => ({
          resources: listProfileIds().map((id) => ({ uri: `client://${id}/profile`, name: `${loadProfile(id).settings.name} profile`, mimeType: "text/markdown" })),
        }),
      }),
      { title: "Client knowledge profile", description: "Account IDs, naming conventions, targeting decisions, report format and tone for one client.", mimeType: "text/markdown" },
      async (uri, vars) => {
        const id = String(vars.client_id);
        logAction({ actor, action: "read_resource:client_profile", scope: "read", client_id: id, args: { uri: uri.href }, result: "ok" });
        return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: loadProfile(id).raw }] };
      },
    );

    server.registerResource(
      "audit-rules",
      "rules://audit",
      { title: "Audit rule thresholds", description: "The thresholds audit_account uses.", mimeType: "application/json" },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(AUDIT_RULES, null, 2) }] }),
    );
  }

  if (scopes.has("draft")) {
    server.registerTool(
      "draft_ad_refresh",
      {
        title: "Draft an ad refresh (PAUSED)",
        description:
          "Write a new version of the weakest ad (lowest CTR) in a campaign and create it on the platform as PAUSED. It does not go live: a human must approve it in the dashboard. Cannot change budgets, statuses or existing ads.",
        inputSchema: { client_id: clientId, campaign_id: z.string().describe("Campaign id, e.g. cmp_np_01") },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      tool("draft_ad_refresh", "draft", async (a: { client_id: string; campaign_id: string }) => {
        const plan = await planAdRefresh(a.client_id, a.campaign_id);
        const draft = await createPausedDraft(plan, actor);
        return jsonResult(`Draft ${draft.id} created with status ${draft.status}. It will not run until approved in the dashboard.`, draft);
      }),
    );
  }

  return server;
}
