import { GoogleAdsAdapter } from "./google-ads";
import { MetaAdapter } from "./meta";
import { MockAdsAdapter } from "./mock";
import type { AdsAdapter } from "./types";

export type { AdsAdapter } from "./types";
export { MockAdsAdapter, GoogleAdsAdapter, MetaAdapter };

let instance: AdsAdapter | null = null;

export function getAdapter(): AdsAdapter {
  if (instance) return instance;
  const kind = process.env.ADS_ADAPTER || "mock";
  if (kind === "mock") instance = new MockAdsAdapter();
  else if (kind === "google_ads") instance = new GoogleAdsAdapter();
  else if (kind === "meta") instance = new MetaAdapter();
  else throw new Error(`Unknown ADS_ADAPTER "${kind}" (use mock, google_ads or meta)`);
  return instance;
}

/** For tests. */
export function setAdapter(a: AdsAdapter | null): void {
  instance = a;
}
