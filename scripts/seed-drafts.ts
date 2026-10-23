/**
 * Creates two example draft ad refreshes (PAUSED) through the MCP server so the dashboard's approval queue has
 * something to review. Usage: npm run seed:drafts
 */
import { callJson, connectInProcess } from "@arc/mcp-server";
import type { DraftAd } from "@arc/core";

const { client, close } = await connectInProcess({ scopes: ["read", "draft"], actor: "seed-script" });
for (const [client_id, campaign_id] of [
  ["northstar-partners", "cmp_np_01"],
  ["glowfield-skincare", "cmp_gf_01"],
]) {
  const d = await callJson<DraftAd>(client, "draft_ad_refresh", { client_id, campaign_id });
  console.log(`${d.id} ${d.status} ${d.campaign_name} → ${d.name}`);
}
await close();
