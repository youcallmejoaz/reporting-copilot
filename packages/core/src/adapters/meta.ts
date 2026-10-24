import type { AdsAdapter } from "./types";

/**
 * Meta Marketing API adapter (stub).
 *
 * To implement, call the Graph API (v2x.0) with META_ACCESS_TOKEN (system user token) and appsecret_proof
 * from META_APP_SECRET. Mapping to our types:
 *   Client      -> ad account (act_<id>); account_ids.meta
 *   Campaign    -> /act_<id>/campaigns (objective)
 *   AdSet       -> /act_<id>/adsets (daily_budget is in cents)
 *   Ad          -> /act_<id>/ads + creative (title/body)
 *   DailyMetric -> /act_<id>/insights?level=ad&time_increment=1&fields=impressions,clicks,spend,
 *                  actions,action_values  (conversions/revenue from the agreed action_type)
 *   createPausedAd -> POST /act_<id>/ads with status=PAUSED (never ACTIVE)
 *   activateAd     -> POST /<ad_id> status=ACTIVE (dashboard approval only)
 */
export class MetaAdapter implements AdsAdapter {
  readonly name = "meta";
  private fail(): never {
    throw new Error("Meta adapter is not configured yet. Set ADS_ADAPTER=mock or implement adapters/meta.ts.");
  }
  listClients = async () => this.fail();
  getClient = async () => this.fail();
  listCampaigns = async () => this.fail();
  listAdSets = async () => this.fail();
  listAds = async () => this.fail();
  getDailyMetrics = async () => this.fail();
  createPausedAd = async () => this.fail();
  activateAd = async () => this.fail();
}
