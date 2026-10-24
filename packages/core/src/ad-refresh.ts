import fs from "node:fs";
import path from "node:path";
import { getAdapter } from "./adapters/index";
import { generateJson, isLive } from "./claude";
import { resolveRange } from "./dates";
import { aggregate, groupBy } from "./metrics";
import { asOfDate, paths } from "./paths";
import { loadProfile } from "./profiles";
import type { NewDraft } from "./drafts";

const SCHEMA = {
  type: "object",
  properties: { headline: { type: "string" }, primary_text: { type: "string" }, rationale: { type: "string" } },
  required: ["headline", "primary_text", "rationale"],
  additionalProperties: false,
};

function nextVersionName(name: string): string {
  const m = /^(.*_v)(\d+)$/.exec(name);
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${name}_v2`;
}

/** Test-mode copy: benefit-first rewrite that keeps the original claims. */
function templateCopy(headline: string, text: string): { headline: string; primary_text: string; rationale: string } {
  const h = headline.replace(/[.!]$/, "");
  return {
    headline: h.length <= 30 ? `${h}, booked in 60 seconds` : h.slice(0, 44),
    primary_text: `${text.replace(/\.$/, "")}. Pick a time that suits you online today.`.slice(0, 125),
    rationale: "Benefit-first headline and a clearer call to action; offer and claims unchanged.",
  };
}

/**
 * Plan a creative refresh for the weakest ad (lowest CTR, last 14 days) in a campaign.
 * Returns the draft input only. Saving it (always PAUSED) is done by createPausedDraft.
 */
export async function planAdRefresh(clientId: string, campaignId: string, asOf = asOfDate()): Promise<NewDraft> {
  const adapter = getAdapter();
  const campaign = (await adapter.listCampaigns(clientId)).find((c) => c.id === campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found for client ${clientId}`);
  const adSets = (await adapter.listAdSets(clientId)).filter((s) => s.campaign_id === campaignId);
  const adSetIds = new Set(adSets.map((s) => s.id));
  const ads = (await adapter.listAds(clientId)).filter((a) => adSetIds.has(a.ad_set_id));
  if (ads.length === 0) throw new Error(`Campaign ${campaignId} has no ads to refresh`);
  const w = resolveRange("last_14d", asOf);
  const rows = (await adapter.getDailyMetrics(clientId, w.start, w.end)).filter((r) => r.campaign_id === campaignId);
  const byAd = groupBy(rows, (r) => r.ad_id);
  const ranked = ads.map((a) => ({ ad: a, t: aggregate(byAd.get(a.id) ?? []) })).sort((x, y) => x.t.ctr - y.t.ctr);
  const weakest = ranked[0];
  const profile = loadProfile(clientId);

  let copy = templateCopy(weakest.ad.headline, weakest.ad.primary_text);
  if (isLive()) {
    copy = await generateJson({
      system: fs.readFileSync(path.join(paths.prompts(), "ad-refresh.md"), "utf8"),
      prompt: `<knowledge_profile>\n${profile.raw}\n</knowledge_profile>\n\n<current_ad>\n${JSON.stringify({ ...weakest.ad, last_14d: weakest.t, campaign: campaign.name }, null, 2)}\n</current_ad>`,
      schema: SCHEMA,
    });
  }
  return {
    client_id: clientId,
    campaign_id: campaignId,
    campaign_name: campaign.name,
    ad_set_id: weakest.ad.ad_set_id,
    replaces_ad_id: weakest.ad.id,
    name: nextVersionName(weakest.ad.name),
    headline: copy.headline,
    primary_text: copy.primary_text,
    rationale: `Replaces ${weakest.ad.name} (CTR ${weakest.t.ctr.toFixed(2)}% over the last 14 days). ${copy.rationale}`,
  };
}
