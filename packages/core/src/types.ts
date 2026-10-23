export type Platform = "meta" | "google";

export interface Client {
  id: string;
  name: string;
  vertical: string;
  platforms: Platform[];
  account_ids: Partial<Record<Platform, string>>;
  currency: string;
}

export interface Campaign {
  id: string;
  client_id: string;
  platform: Platform;
  name: string;
  objective: string;
  status: "ACTIVE" | "PAUSED";
}

/** Meta ad set / Google ad group. Budgets are kept at this level in the sample data. */
export interface AdSet {
  id: string;
  campaign_id: string;
  name: string;
  daily_budget: number;
}

export interface Ad {
  id: string;
  ad_set_id: string;
  name: string;
  headline: string;
  primary_text: string;
  status: "ACTIVE" | "PAUSED";
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  client_id: string;
  platform: Platform;
  campaign_id: string;
  ad_set_id: string;
  ad_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  /** Purchase value (ecommerce) or modelled lead value (lead gen). */
  revenue: number;
}

export interface Totals {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number; // %
  cpc: number;
  cpa: number | null;
  roas: number | null;
  cvr: number; // %
}

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export interface ClientProfile {
  client_id: string;
  /** Flat key/values from the profile front matter. */
  settings: ProfileSettings;
  /** Markdown body (without front matter). */
  body: string;
  /** Full file as stored on disk. */
  raw: string;
  path: string;
}

export interface ProfileSettings {
  name: string;
  short_name: string;
  aliases: string[];
  target_roas: number;
  monthly_budget: number;
  naming_pattern: string;
  naming_example: string;
  conversion_label: string;
  email_to: string;
  email_style: "friendly" | "formal" | "plain";
  email_greeting: string;
  email_signoff: string;
  brand_as: string;
  /** Reports and emails go out under the client's brand: no agency name, tools or AI mentioned. */
  white_label: boolean;
}

export type Severity = "red" | "amber";

export interface AuditFinding {
  rule: "roas_below_1" | "wasted_spend" | "broken_naming" | "overspend" | "low_ctr" | "budget_pacing";
  severity: Severity;
  entity_type: "account" | "campaign" | "ad_set" | "ad";
  entity_id: string;
  entity_name: string;
  /** Campaign the entity belongs to (same as entity_id for campaign findings). */
  campaign_id?: string;
  reason: string;
  recommendation: string;
  metric?: Record<string, number | string | null>;
}

export type DraftStatus = "PAUSED" | "APPROVED" | "REJECTED";

export interface DraftAd {
  id: string;
  client_id: string;
  campaign_id: string;
  campaign_name: string;
  ad_set_id: string;
  replaces_ad_id: string | null;
  name: string;
  headline: string;
  primary_text: string;
  rationale: string;
  status: DraftStatus;
  external_id: string | null;
  created_at: string;
  created_by: string;
  decided_at: string | null;
  decided_by: string | null;
}
