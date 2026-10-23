import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  anthropic,
  fmtMoney,
  fmtPct,
  fmtRoas,
  isLive,
  listProfileIds,
  loadProfile,
  modeLabel,
  modelId,
  prettyRange,
  requestDefaults,
  type AuditFinding,
  type MtdSummary,
  type CampaignMetricsResult,
  type DraftAd,
} from "@arc/core";
import { callJson, connectInProcess } from "@arc/mcp-server";

export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  is_error: boolean;
}

export interface AskResult {
  answer: string;
  tool_calls: ToolCallTrace[];
  mode: string;
}

const SYSTEM = `You are the reporting copilot for a paid media agency that manages Meta and Google Ads for several clients.
Answer questions using the ads-data tools. Always pull numbers from the tools; never estimate or invent figures.
Read the client's knowledge profile (read_client_profile) when you need targets, naming conventions or tone.
Keep answers short: a one-line headline, then 3-6 bullets with the key numbers (spend, conversions, cost per conversion, ROAS vs target, pacing), then one suggested next step.
draft_ad_refresh only creates PAUSED drafts for human approval in the dashboard. Never say an ad is live.`;

async function traced(client: Client, calls: ToolCallTrace[], name: string, args: Record<string, unknown>): Promise<string> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  calls.push({ name, args, summary: text.split("\n")[0].slice(0, 200), is_error: Boolean(res.isError) });
  return text;
}

/** Live mode: Claude drives the MCP tools in a manual tool-use loop. */
async function askLive(question: string, client: Client, calls: ToolCallTrace[]): Promise<string> {
  const { tools: mcpTools } = await client.listTools();
  const tools: Anthropic.Beta.BetaTool[] = [
    ...mcpTools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
    })),
    {
      name: "read_client_profile",
      description: "Read a client's knowledge profile (targets, naming convention, targeting decisions, report format, tone).",
      input_schema: { type: "object", properties: { client_id: { type: "string" } }, required: ["client_id"] },
    },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: question }];
  for (let turn = 0; turn < 8; turn++) {
    const response = await anthropic().beta.messages.create({
      ...requestDefaults(),
      model: modelId(),
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "low" },
      tools,
      messages,
    });
    if (response.stop_reason === "refusal") return "Claude declined to answer this question.";
    messages.push({ role: "assistant", content: response.content });
    const uses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || uses.length === 0) {
      if (response.stop_reason === "pause_turn") continue;
      return response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      uses.map(async (u) => {
        const args = (u.input ?? {}) as Record<string, unknown>;
        if (u.name === "read_client_profile") {
          const res = await client.readResource({ uri: `client://${String(args.client_id)}/profile` });
          const text = res.contents.map((c) => ("text" in c ? c.text : "")).join("\n");
          calls.push({ name: "read_client_profile", args, summary: `client://${String(args.client_id)}/profile`, is_error: false });
          return { type: "tool_result" as const, tool_use_id: u.id, content: text };
        }
        const text = await traced(client, calls, u.name, args);
        return { type: "tool_result" as const, tool_use_id: u.id, content: text, is_error: calls[calls.length - 1].is_error };
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return "I stopped after too many tool calls. Try a narrower question.";
}

/** Find the client a question is about from profile aliases. */
export function matchClient(question: string): string | null {
  const q = question.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const id of listProfileIds()) {
    for (const alias of [id, ...loadProfile(id).settings.aliases]) {
      if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(q) && (!best || alias.length > best.len)) best = { id, len: alias.length };
    }
  }
  return best?.id ?? null;
}

const delta = (x: number | null, what = "vs the same days last month") => (x === null ? "" : ` (${fmtPct(x)} ${what})`);

/** Test mode: a deterministic router that still makes real MCP tool calls and answers only from their output. */
async function askTestMode(question: string, client: Client, calls: ToolCallTrace[]): Promise<string> {
  const q = question.toLowerCase();
  const clientId = matchClient(question);
  const json = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const text = await traced(client, calls, name, args);
    if (calls[calls.length - 1].is_error) throw new Error(text);
    return JSON.parse(text.slice(text.indexOf("\n\n") + 2)) as T;
  };

  if (!clientId) {
    const { clients } = await json<{ clients: { client_id: string; name: string; vertical: string; target_roas: number }[] }>("list_clients", {});
    return [`I manage ${clients.length} client accounts. Ask about one by name, for example "How did the roofing client do this month?"`, "", ...clients.map((c) => `- **${c.name}** (${c.vertical}), target ROAS ${c.target_roas.toFixed(1)}`)].join("\n");
  }
  const profile = loadProfile(clientId).settings;

  if (/\b(audit|wrong|problem|issue|flag|naming|waste)/.test(q)) {
    const r = await json<{ findings: AuditFinding[] }>("audit_account", { client_id: clientId });
    if (r.findings.length === 0) return `**${profile.name}**: the audit found no problems.`;
    return [`**${profile.name}** audit: ${r.findings.length} finding(s).`, "", ...r.findings.map((f) => `- ${f.severity === "red" ? "🔴" : "🟠"} **${f.entity_name}**: ${f.reason} _${f.recommendation}_`)].join("\n");
  }

  if (/\b(draft|refresh|new ad|creative)/.test(q)) {
    const audit = await json<{ findings: AuditFinding[] }>("audit_account", { client_id: clientId });
    const metrics = await json<CampaignMetricsResult>("get_campaign_metrics", { client_id: clientId, date_range: "last_14d" });
    const flaggedAd = audit.findings.find((f) => f.rule === "low_ctr");
    const target = flaggedAd
      ? metrics.campaigns.find((c) => c.campaign_id === flaggedAd.campaign_id)
      : [...metrics.campaigns].sort((a, b) => (a.totals.roas ?? 0) - (b.totals.roas ?? 0))[0];
    if (!target) return `I could not find a campaign to refresh for ${profile.name}.`;
    const d = await json<DraftAd>("draft_ad_refresh", { client_id: clientId, campaign_id: target.campaign_id });
    return [`Drafted a refresh for **${d.campaign_name}**. It is **PAUSED** and waiting for your approval in Drafts.`, "", `- New ad: \`${d.name}\``, `- Headline: "${d.headline}"`, `- Text: "${d.primary_text}"`, `- Why: ${d.rationale}`].join("\n");
  }

  if (/\b(underperform|worst|below target|losing)/.test(q)) {
    const r = await json<{ roas_threshold: number; underperformers: { name: string; roas: number | null; spend: number }[] }>("find_underperformers", { client_id: clientId });
    if (r.underperformers.length === 0) return `**${profile.name}**: every campaign is at or above ROAS ${r.roas_threshold.toFixed(1)} over the last 14 days.`;
    return [`**${profile.name}**: ${r.underperformers.length} campaign(s) below ROAS ${r.roas_threshold.toFixed(1)} (last 14 days).`, "", ...r.underperformers.map((u) => `- ${u.name}: ROAS ${fmtRoas(u.roas)} on ${fmtMoney(u.spend)} spend`)].join("\n");
  }

  if (/\b(last week|this week|past week|7 days|weekly)/.test(q)) {
    const m = await json<CampaignMetricsResult>("get_campaign_metrics", { client_id: clientId, date_range: "last_7d" });
    const t = m.totals;
    return [
      `**${m.client_name}**, ${prettyRange(m.range)}: ROAS **${fmtRoas(t.roas)}** vs a ${m.target_roas.toFixed(1)} target.`,
      "",
      `- Spend: ${fmtMoney(t.spend)}`,
      `- ${profile.conversion_label}: ${t.conversions} at ${fmtMoney(t.cpa, 2)} each`,
      `- Best campaign: ${m.campaigns.slice().sort((a, b) => (b.totals.roas ?? 0) - (a.totals.roas ?? 0))[0]?.name}`,
    ].join("\n");
  }

  const m = await json<MtdSummary>("get_mtd_summary", { client_id: clientId });
  const t = m.totals;
  const onTarget = (t.roas ?? 0) >= m.target_roas;
  const best = m.top_campaigns[0];
  const worst = m.bottom_campaigns[0];
  return [
    `**${m.client_name}** is ${onTarget ? "ahead of" : "behind"} target this month: ROAS **${fmtRoas(t.roas)}** vs ${m.target_roas.toFixed(1)} (${prettyRange(m.range)}, month to date).`,
    "",
    `- **Spend:** ${fmtMoney(t.spend)}${delta(m.change_vs_previous_pct.spend)}`,
    `- **${profile.conversion_label.replace(/^./, (c) => c.toUpperCase())}:** ${t.conversions}${delta(m.change_vs_previous_pct.conversions)} at **${fmtMoney(t.cpa, 2)}** each`,
    `- **${profile.conversion_label === "purchases" ? "Revenue" : "Modelled value"}:** ${fmtMoney(t.revenue)}${delta(m.change_vs_previous_pct.revenue)}`,
    `- **Pacing:** projected ${fmtMoney(m.pacing.projected_month_spend)}, ${m.pacing.projected_pct_of_budget}% of the ${fmtMoney(m.pacing.monthly_budget)} budget`,
    best ? `- **Best campaign:** ${best.name} at ROAS ${fmtRoas(best.roas)}` : "",
    worst && worst !== best ? `- **Weakest:** ${worst.name} at ROAS ${fmtRoas(worst.roas)}` : "",
    "",
    "Want me to run the account audit or draft this week's report?",
  ]
    .filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "")
    .join("\n");
}

export async function ask(question: string): Promise<AskResult> {
  const { client, close } = await connectInProcess({ actor: "ask" });
  const calls: ToolCallTrace[] = [];
  try {
    const answer = isLive() ? await askLive(question, client, calls) : await askTestMode(question, client, calls);
    return { answer, tool_calls: calls, mode: modeLabel() };
  } finally {
    await close();
  }
}

export { callJson };
