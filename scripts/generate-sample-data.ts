/**
 * Generates 60 days of fictional Meta + Google Ads data for four fictional clients.
 * Deterministic (seeded), so tests and videos always see the same numbers.
 *
 * Planted problems (the audit must find every one, and nothing else):
 *  - Glowfield Skincare: prospecting campaign with ROAS ~0.7
 *  - Ridgeline Roofing: two campaigns that break the naming convention
 *  - Harbor Law Group: a Meta ad set spending ~140% of its daily budget
 *  - Harbor Law Group: a display remarketing campaign with spend and zero leads (wasted spend)
 *  - Northstar Partners (white label): an ad with CTR ~0.25%
 */
import fs from "node:fs";
import path from "node:path";
import type { Ad, AdSet, Campaign, Client, DailyMetric, Platform } from "../packages/core/src/types.js";
import { addDays } from "../packages/core/src/dates.js";

const END = process.env.AS_OF_DATE || "2026-10-22";
const DAYS = 60;
const OUT = path.join(process.cwd(), "data", "sample");

// mulberry32
let seed = 20261022;
function rand(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const jitter = (pct: number) => 1 + (rand() * 2 - 1) * pct;
/** Stochastic rounding keeps small daily counts honest on average. */
const sround = (x: number) => Math.floor(x) + (rand() < x - Math.floor(x) ? 1 : 0);
const money = (x: number) => Math.round(x * 100) / 100;

interface AdSpec {
  name: string;
  headline: string;
  text: string;
  ctrMult?: number;
}
interface AdSetSpec {
  name: string;
  budget: number;
  /** Actual spend as a share of budget (default ~0.95). */
  pacing?: number;
  /** One or two ads. */
  ads: AdSpec[];
}
interface CampaignSpec {
  name: string;
  platform: Platform;
  objective: string;
  cpc: number;
  ctr: number; // fraction
  cvr: number; // fraction
  value: number; // AOV or lead value
  adSets: AdSetSpec[];
}
interface ClientSpec {
  client: Client;
  prefix: string;
  campaigns: CampaignSpec[];
}

const ad = (name: string, headline: string, text: string, ctrMult?: number): AdSpec => ({ name, headline, text, ctrMult });

const specs: ClientSpec[] = [
  {
    prefix: "gf",
    client: {
      id: "glowfield-skincare",
      name: "Glowfield Skincare",
      vertical: "Ecommerce · skincare",
      platforms: ["meta", "google"],
      account_ids: { meta: "act_000000000101", google: "000-000-0101" },
      currency: "USD",
    },
    campaigns: [
      {
        name: "GF_META_PROS_BroadVideo", platform: "meta", objective: "Sales", cpc: 1.1, ctr: 0.011, cvr: 0.013, value: 58,
        adSets: [
          { name: "Broad_F25-54_US", budget: 90, ads: [ad("Video_UGC_MorningRoutine_v1", "The 3-step routine that fixed my skin", "Real customers, real results. Try the Glowfield starter set."), ad("Video_Founder_Story_v1", "Made by a dermatologist, for sensitive skin", "Fragrance-free, barrier-first skincare. Free shipping over $40.")] },
          { name: "Interest_SkincareFans_US", budget: 90, ads: [ad("Video_BeforeAfter_v2", "28 days. No filters.", "See what a barrier-first routine does in four weeks."), ad("Carousel_Bestsellers_v1", "Our bestsellers, all under $35", "Cleanser, serum, moisturizer. Pick your trio.")] },
        ],
      },
      {
        name: "GF_META_RET_Cart30d", platform: "meta", objective: "Sales", cpc: 0.9, ctr: 0.018, cvr: 0.07, value: 58,
        adSets: [
          { name: "CartAbandon_30d", budget: 40, ads: [ad("Static_CartReminder_v3", "Still thinking it over?", "Your cart is waiting, and shipping is on us this week."), ad("Static_Reviews_v2", "4.8 stars from 12,000+ customers", "See why people switch to Glowfield.")] },
          { name: "Viewers_ProductPage_30d", budget: 30, ads: [ad("Carousel_ViewedProducts_v1", "Picked up where you left off", "The products you viewed, back in stock."), ad("Static_Bundle_v1", "Save 15% on the full routine", "Bundle and save on cleanser, serum and SPF.")] },
        ],
      },
      {
        name: "GF_GGL_SHOP_AllProducts", platform: "google", objective: "Sales", cpc: 0.6, ctr: 0.014, cvr: 0.045, value: 58,
        adSets: [
          { name: "Shopping_Bestsellers", budget: 70, ads: [ad("Shopping_Feed_Bestsellers", "Glowfield Barrier Serum", "Product feed listing")] },
          { name: "Shopping_Catchall", budget: 50, ads: [ad("Shopping_Feed_Catchall", "Glowfield Gentle Cleanser", "Product feed listing"), ad("Shopping_Feed_Bundles", "Glowfield Routine Bundle", "Product feed listing")] },
        ],
      },
      {
        name: "GF_GGL_BRAND_Search", platform: "google", objective: "Sales", cpc: 0.4, ctr: 0.09, cvr: 0.07, value: 58,
        adSets: [
          { name: "Brand_Exact", budget: 20, ads: [ad("RSA_Brand_Core_v1", "Glowfield Skincare | Official Site", "Barrier-first skincare. Free shipping over $40."), ad("RSA_Brand_Offer_v1", "Glowfield | 15% Off Your First Order", "Dermatologist developed. Fragrance free.")] },
          { name: "Brand_Phrase", budget: 15, ads: [ad("RSA_Brand_Reviews_v1", "Glowfield Reviews | 4.8 Stars", "Join 12,000+ happy customers."), ad("RSA_Brand_Shipping_v1", "Glowfield | Fast Free Shipping", "Order today, ships in 24 hours.")] },
        ],
      },
    ],
  },
  {
    prefix: "rr",
    client: {
      id: "ridgeline-roofing",
      name: "Ridgeline Roofing Co.",
      vertical: "Local services · roofing lead gen",
      platforms: ["google", "meta"],
      account_ids: { google: "000-000-0202", meta: "act_000000000202" },
      currency: "USD",
    },
    campaigns: [
      {
        name: "RR_GGL_SRCH_RoofRepair", platform: "google", objective: "Leads", cpc: 9, ctr: 0.05, cvr: 0.12, value: 450,
        adSets: [
          { name: "RoofRepair_Exact", budget: 60, ads: [ad("RSA_Repair_Fast_v2", "Roof Leak? Same-Week Repairs", "Licensed & insured. Free inspection, upfront pricing."), ad("RSA_Repair_Local_v1", "Local Roof Repair Experts", "Family owned for 20 years. Call for a free quote.")] },
          { name: "RoofRepair_Phrase", budget: 40, ads: [ad("RSA_Repair_Warranty_v1", "Roof Repairs With 10-Yr Warranty", "Workmanship guaranteed. Book online in 2 minutes."), ad("RSA_Repair_Financing_v1", "Roof Repair Financing Available", "0% options for qualified homeowners.")] },
        ],
      },
      {
        name: "RR_GGL_SRCH_RoofReplacement", platform: "google", objective: "Leads", cpc: 11, ctr: 0.04, cvr: 0.1, value: 450,
        adSets: [
          { name: "Replacement_Exact", budget: 70, ads: [ad("RSA_Replace_Quote_v1", "New Roof Quotes in 24 Hours", "Asphalt, metal and tile. Free drone inspection."), ad("RSA_Replace_Brands_v1", "Certified Installer, Top Shingle Brands", "Lifetime manufacturer warranty available.")] },
          { name: "Replacement_Phrase", budget: 50, ads: [ad("RSA_Replace_Financing_v1", "Roof Replacement Financing", "Low monthly payments. Apply in minutes."), ad("RSA_Replace_Reviews_v1", "4.9★ Rated Roofers Near You", "500+ local roofs replaced.")] },
        ],
      },
      {
        // PLANTED: broken naming (no prefix/platform/objective tokens)
        name: "roof ads new FINAL", platform: "google", objective: "Leads", cpc: 7, ctr: 0.045, cvr: 0.09, value: 450,
        adSets: [
          { name: "storm damage", budget: 50, ads: [ad("RSA_Storm_Inspect_v1", "Storm Damage? Free Roof Inspection", "We work directly with your insurance company."), ad("RSA_Storm_Hail_v1", "Hail Damage Roof Repair", "Fast inspections after every storm.")] },
          { name: "storm damage 2", budget: 30, ads: [ad("RSA_Storm_Claims_v1", "Help With Roof Insurance Claims", "We handle the paperwork. You get a new roof."), ad("RSA_Storm_Tarp_v1", "Emergency Roof Tarping 24/7", "Call now for same-day emergency service.")] },
        ],
      },
      {
        // PLANTED: broken naming (duplicated campaign left as "Copy of ...")
        name: "Copy of RR_META_LEADS_Homeowners", platform: "meta", objective: "Leads", cpc: 2.5, ctr: 0.013, cvr: 0.03, value: 450,
        adSets: [
          { name: "Homeowners_35-65_25mi", budget: 35, ads: [ad("Video_DroneInspection_v1", "See your roof from above, free", "Book a free drone inspection this week."), ad("Static_Financing_v1", "New roof, low monthly payments", "Financing for qualified homeowners.")] },
          { name: "Lookalike_PastCustomers_2pct", budget: 25, ads: [ad("Static_Reviews_v1", "500+ neighbors trust Ridgeline", "Read reviews from homeowners near you."), ad("Video_Crew_v1", "Meet the crew that will treat your home like ours", "Licensed, insured and local.")] },
        ],
      },
    ],
  },
  {
    prefix: "hl",
    client: {
      id: "harbor-law",
      name: "Harbor Law Group",
      vertical: "Legal · personal injury lead gen",
      platforms: ["google", "meta"],
      account_ids: { google: "000-000-0303", meta: "act_000000000303" },
      currency: "USD",
    },
    campaigns: [
      {
        name: "HL_GGL_SRCH_CarAccident", platform: "google", objective: "Leads", cpc: 45, ctr: 0.04, cvr: 0.18, value: 900,
        adSets: [
          { name: "CarAccident_Exact", budget: 150, ads: [ad("RSA_CarAccident_FreeConsult_v1", "Injured in a Car Accident?", "Free consultation. No fee unless we win."), ad("RSA_CarAccident_Results_v1", "Car Accident Lawyers, Proven Results", "Talk to an attorney today, 24/7.")] },
          { name: "CarAccident_Phrase", budget: 150, ads: [ad("RSA_CarAccident_Local_v1", "Local Car Accident Attorneys", "Serving the county for 25 years."), ad("RSA_CarAccident_Insurance_v1", "Insurance Lowballing You?", "We fight for the full settlement you deserve.")] },
        ],
      },
      {
        name: "HL_GGL_SRCH_WorkInjury", platform: "google", objective: "Leads", cpc: 30, ctr: 0.035, cvr: 0.14, value: 900,
        adSets: [
          { name: "WorkInjury_Exact", budget: 100, ads: [ad("RSA_WorkInjury_Comp_v1", "Hurt at Work? Know Your Rights", "Workers' comp claims handled start to finish."), ad("RSA_WorkInjury_Denied_v1", "Workers' Comp Claim Denied?", "We appeal denied claims. Free review.")] },
          { name: "WorkInjury_Phrase", budget: 80, ads: [ad("RSA_WorkInjury_Construction_v1", "Construction Injury Lawyers", "No fee unless we recover compensation."), ad("RSA_WorkInjury_Call_v1", "Speak With an Attorney Today", "Free, confidential case review.")] },
        ],
      },
      {
        name: "HL_META_LEADS_LocalLookalike", platform: "meta", objective: "Leads", cpc: 4, ctr: 0.012, cvr: 0.022, value: 900,
        adSets: [
          // PLANTED: overspending ad set (~140% of daily budget)
          { name: "Lookalike_1pct_Clients", budget: 60, pacing: 1.4, ads: [ad("Static_FreeConsult_v2", "Hurt in an accident? Free case review", "Find out what your case is worth in 2 minutes."), ad("Video_Attorney_Intro_v1", "Meet the attorney who will fight for you", "No fee unless we win.")] },
          { name: "Local_Adults_25-64_20mi", budget: 40, ads: [ad("Static_Testimonial_v1", "\"They got me 3x the insurance offer\"", "Read client stories."), ad("Static_NoFee_v1", "No win, no fee. Ever.", "Free consultation, available 24/7.")] },
        ],
      },
      {
        // PLANTED: wasted spend — display remarketing that never produces a lead
        name: "HL_GGL_DISP_Remarketing", platform: "google", objective: "Leads", cpc: 1.5, ctr: 0.009, cvr: 0, value: 900,
        adSets: [
          { name: "SiteVisitors_30d", budget: 25, ads: [ad("Display_Banner_FreeConsult_v1", "Still need help with your case?", "Free consultation."), ad("Display_Banner_Results_v1", "$50M+ recovered for clients", "Call today.")] },
          { name: "SiteVisitors_90d", budget: 15, ads: [ad("Display_Banner_NoFee_v1", "No fee unless we win", "Talk to a lawyer today."), ad("Display_Banner_Reviews_v1", "5-star rated injury lawyers", "Read our reviews.")] },
        ],
      },
    ],
  },
  {
    prefix: "np",
    client: {
      id: "northstar-partners",
      name: "Northstar Partners (white label)",
      vertical: "White-label agency · dental clinic group lead gen",
      platforms: ["meta", "google"],
      account_ids: { meta: "act_000000000404", google: "000-000-0404" },
      currency: "USD",
    },
    campaigns: [
      {
        name: "NP_META_LEADS_NewPatient", platform: "meta", objective: "Leads", cpc: 2.2, ctr: 0.015, cvr: 0.05, value: 220,
        adSets: [
          // PLANTED: low CTR creative
          { name: "Adults_25-55_10mi", budget: 45, ads: [ad("Static_Offer_v1", "New patient special", "Exam, x-rays and cleaning. Book online.", 0.17), ad("Video_Tour_v1", "Take a 30-second tour of our clinic", "Gentle care, modern equipment, Saturday hours.")] },
          { name: "Parents_Interest_10mi", budget: 35, ads: [ad("Static_Family_v1", "Family dentistry, one visit for everyone", "Book back-to-back appointments for the whole family."), ad("Carousel_Smiles_v1", "Real patients, real smiles", "See before and afters from our patients.")] },
        ],
      },
      {
        name: "NP_GGL_SRCH_Implants", platform: "google", objective: "Leads", cpc: 8, ctr: 0.05, cvr: 0.09, value: 220,
        adSets: [
          { name: "Implants_Exact", budget: 60, ads: [ad("RSA_Implants_Consult_v1", "Dental Implants, Free Consultation", "Financing available. Same-day CT scan."), ad("RSA_Implants_Price_v1", "Affordable Dental Implants", "Transparent pricing, no surprises.")] },
          { name: "Implants_Phrase", budget: 40, ads: [ad("RSA_Implants_AllOn4_v1", "All-on-4 Implants Near You", "Permanent teeth in a day."), ad("RSA_Implants_Reviews_v1", "Top Rated Implant Dentists", "Hundreds of 5-star reviews.")] },
        ],
      },
      {
        name: "NP_META_RET_SiteVisitors", platform: "meta", objective: "Leads", cpc: 1.5, ctr: 0.016, cvr: 0.04, value: 220,
        adSets: [
          { name: "Visitors_30d", budget: 20, ads: [ad("Static_BookNow_v1", "Your smile is waiting", "Book your visit in under a minute."), ad("Static_Saturday_v1", "Open Saturdays", "Appointments that fit your week.")] },
          { name: "FormStarters_14d", budget: 15, ads: [ad("Static_Finish_v1", "Finish booking your visit", "It takes less than a minute."), ad("Static_Insurance_v1", "We accept most insurance", "Check your coverage instantly.")] },
        ],
      },
      {
        name: "NP_GGL_PMAX_Local", platform: "google", objective: "Leads", cpc: 1.8, ctr: 0.025, cvr: 0.035, value: 220,
        adSets: [
          { name: "AssetGroup_General", budget: 50, ads: [ad("PMAX_General_v1", "Gentle Dentistry Near You", "Asset group")] },
          { name: "AssetGroup_Emergency", budget: 30, ads: [ad("PMAX_Emergency_v1", "Emergency Dentist Today", "Asset group")] },
        ],
      },
    ],
  },
];

const clients: Client[] = [];
const campaigns: Campaign[] = [];
const adSets: AdSet[] = [];
const ads: Ad[] = [];
const metrics: DailyMetric[] = [];

const dates = Array.from({ length: DAYS }, (_, i) => addDays(END, i - (DAYS - 1)));

for (const spec of specs) {
  clients.push(spec.client);
  spec.campaigns.forEach((c, ci) => {
    const campaign: Campaign = {
      id: `cmp_${spec.prefix}_${String(ci + 1).padStart(2, "0")}`,
      client_id: spec.client.id,
      platform: c.platform,
      name: c.name,
      objective: c.objective,
      status: "ACTIVE",
    };
    campaigns.push(campaign);
    c.adSets.forEach((s, si) => {
      const adSet: AdSet = { id: `${campaign.id.replace("cmp", "as")}${"ab"[si]}`, campaign_id: campaign.id, name: s.name, daily_budget: s.budget };
      adSets.push(adSet);
      const adSpecs = s.ads;
      const shares = adSpecs.length === 1 ? [1] : [0.56, 0.44];
      adSpecs.forEach((a, ai) => {
        const adRow: Ad = {
          id: `${adSet.id.replace("as", "ad")}${ai + 1}`,
          ad_set_id: adSet.id,
          name: a.name,
          headline: a.headline,
          primary_text: a.text,
          status: "ACTIVE",
        };
        ads.push(adRow);
        for (const date of dates) {
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          const dowFactor = dow === 0 || dow === 6 ? 0.92 : 1.03;
          const pacing = (s.pacing ?? 0.95) * jitter(0.12) * dowFactor;
          const spendTarget = s.budget * pacing * shares[ai];
          const cpc = c.cpc * jitter(0.1);
          const clicks = Math.max(0, sround(spendTarget / cpc));
          const spend = money(clicks * cpc);
          const ctr = c.ctr * (a.ctrMult ?? 1) * jitter(0.15);
          const impressions = clicks === 0 ? sround((spendTarget / cpc) / ctr) : Math.round(clicks / ctr);
          const conversions = sround(clicks * c.cvr * jitter(0.25));
          const revenue = money(conversions * c.value * jitter(0.2));
          metrics.push({
            date, client_id: spec.client.id, platform: c.platform, campaign_id: campaign.id, ad_set_id: adSet.id, ad_id: adRow.id,
            impressions, clicks, spend, conversions, revenue,
          });
        }
      });
    });
  });
}

const planted = [
  { client_id: "glowfield-skincare", rule: "roas_below_1", entity_id: "cmp_gf_01", note: "Prospecting campaign returning ~$0.70 per $1" },
  { client_id: "ridgeline-roofing", rule: "broken_naming", entity_id: "cmp_rr_03", note: "\"roof ads new FINAL\"" },
  { client_id: "ridgeline-roofing", rule: "broken_naming", entity_id: "cmp_rr_04", note: "\"Copy of RR_META_LEADS_Homeowners\"" },
  { client_id: "harbor-law", rule: "overspend", entity_id: "as_hl_03a", note: "Lookalike ad set spending ~140% of its daily budget" },
  { client_id: "harbor-law", rule: "wasted_spend", entity_id: "cmp_hl_04", note: "Display remarketing with spend and zero leads" },
  { client_id: "northstar-partners", rule: "low_ctr", entity_id: "ad_np_01a1", note: "Static offer creative with CTR ~0.25%" },
];

fs.mkdirSync(OUT, { recursive: true });
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1) + "\n");
write("clients.json", clients);
write("campaigns.json", campaigns);
write("ad_sets.json", adSets);
write("ads.json", ads);
// One row per line keeps the file diffable and ~40% smaller.
fs.writeFileSync(path.join(OUT, "daily_metrics.json"), "[\n" + metrics.map((m) => JSON.stringify(m)).join(",\n") + "\n]\n");
write("planted_problems.json", planted);
console.log(`Wrote ${clients.length} clients, ${campaigns.length} campaigns, ${adSets.length} ad sets, ${ads.length} ads, ${metrics.length} metric rows (${dates[0]} → ${END}) to data/sample/`);
