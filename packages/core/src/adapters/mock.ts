import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { paths } from "../paths";
import type { Ad, AdSet, Campaign, Client, DailyMetric } from "../types";
import type { AdsAdapter } from "./types";

interface Dataset {
  clients: Client[];
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  metrics: DailyMetric[];
}

let cache: Dataset | null = null;

function load(): Dataset {
  if (cache) return cache;
  const dir = paths.sampleData();
  const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T;
  cache = {
    clients: read("clients.json"),
    campaigns: read("campaigns.json"),
    adSets: read("ad_sets.json"),
    ads: read("ads.json"),
    metrics: read("daily_metrics.json"),
  };
  return cache;
}

/** Sample-data adapter. Behaves like a real ad platform API, backed by data/sample/*.json. */
export class MockAdsAdapter implements AdsAdapter {
  readonly name = "mock";
  /** Paused ads "created" on the mock platform, for inspection in tests. */
  readonly created = new Map<string, { status: "PAUSED" | "ACTIVE"; name: string }>();

  async listClients() {
    return load().clients;
  }
  async getClient(clientId: string) {
    const c = load().clients.find((x) => x.id === clientId);
    if (!c) throw new Error(`Unknown client_id "${clientId}". Call list_clients to see valid ids.`);
    return c;
  }
  async listCampaigns(clientId: string) {
    await this.getClient(clientId);
    return load().campaigns.filter((c) => c.client_id === clientId);
  }
  async listAdSets(clientId: string) {
    const ids = new Set((await this.listCampaigns(clientId)).map((c) => c.id));
    return load().adSets.filter((s) => ids.has(s.campaign_id));
  }
  async listAds(clientId: string) {
    const ids = new Set((await this.listAdSets(clientId)).map((s) => s.id));
    return load().ads.filter((a) => ids.has(a.ad_set_id));
  }
  async getDailyMetrics(clientId: string, start: string, end: string) {
    await this.getClient(clientId);
    return load().metrics.filter((m) => m.client_id === clientId && m.date >= start && m.date <= end);
  }
  async createPausedAd(draft: { name: string }) {
    const external_id = `mock_ad_${randomUUID().slice(0, 8)}`;
    this.created.set(external_id, { status: "PAUSED", name: draft.name });
    return { external_id };
  }
  async activateAd(_clientId: string, externalId: string) {
    const ad = this.created.get(externalId);
    if (ad) ad.status = "ACTIVE";
    else this.created.set(externalId, { status: "ACTIVE", name: "(created in another process)" });
  }
}
