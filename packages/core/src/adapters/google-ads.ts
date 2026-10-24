import type { AdsAdapter } from "./types";

/**
 * Google Ads API adapter (stub).
 *
 * To implement, use the Google Ads API (REST or the `google-ads-api` package) with
 * GOOGLE_ADS_DEVELOPER_TOKEN / CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN / LOGIN_CUSTOMER_ID.
 * Mapping to our types:
 *   Client      -> customer (customer_client under the MCC); account_ids.google = customer.id
 *   Campaign    -> campaign (id, name, advertising_channel_type -> objective)
 *   AdSet       -> ad_group (budget lives on campaign_budget; split by ad group share)
 *   Ad          -> ad_group_ad (responsive_search_ad headlines/descriptions)
 *   DailyMetric -> GAQL: SELECT segments.date, metrics.impressions, metrics.clicks,
 *                  metrics.cost_micros, metrics.conversions, metrics.conversions_value
 *                  FROM ad_group_ad WHERE segments.date BETWEEN ...
 *                  (spend = cost_micros / 1e6)
 *   createPausedAd -> AdGroupAdService.mutate with status = PAUSED (never ENABLED)
 *   activateAd     -> AdGroupAdService.mutate status = ENABLED (dashboard approval only)
 */
export class GoogleAdsAdapter implements AdsAdapter {
  readonly name = "google_ads";
  private fail(): never {
    throw new Error("Google Ads adapter is not configured yet. Set ADS_ADAPTER=mock or implement adapters/google-ads.ts.");
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
