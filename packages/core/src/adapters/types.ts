import type { Ad, AdSet, Campaign, Client, DailyMetric, DraftAd } from "../types";

/** What an ads platform must provide. Read methods power reporting; the draft methods are the only writes. */
export interface AdsAdapter {
  readonly name: string;
  listClients(): Promise<Client[]>;
  getClient(clientId: string): Promise<Client>;
  listCampaigns(clientId: string): Promise<Campaign[]>;
  listAdSets(clientId: string): Promise<AdSet[]>;
  listAds(clientId: string): Promise<Ad[]>;
  getDailyMetrics(clientId: string, start: string, end: string): Promise<DailyMetric[]>;
  /**
   * Create the ad on the platform in PAUSED state and return the platform id.
   * Implementations MUST create it paused. There is deliberately no status argument.
   */
  createPausedAd(draft: Pick<DraftAd, "client_id" | "campaign_id" | "ad_set_id" | "name" | "headline" | "primary_text">): Promise<{ external_id: string }>;
  /** Activate a previously created paused ad. Only the dashboard approval path calls this. */
  activateAd(clientId: string, externalId: string): Promise<void>;
}
