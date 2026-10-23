import fs from "node:fs";
import path from "node:path";
import { generateJson, isLive, modeLabel } from "./claude.js";
import { fmtMoney, fmtRoas } from "./format.js";
import { prettyRange } from "./dates.js";
import { paths } from "./paths.js";
import type { WeeklyReport } from "./report.js";
import type { ClientProfile } from "./types.js";

export interface RecapEmail {
  to: string;
  subject: string;
  body: string;
  written_by: string;
}

const SCHEMA = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
  additionalProperties: false,
};

/** Lowercase a sentence start ("Blended ROAS" stays, "Pause the" -> "pause the"), never an identifier. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) && !/^\S*_/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const stripDot = (s: string) => s.replace(/\.$/, "");

/** Test-mode recap: uses the profile's greeting, sign-off and style. */
export function templateRecap(r: WeeklyReport, profile: ClientProfile): Omit<RecapEmail, "written_by"> {
  const s = profile.settings;
  const period = prettyRange(r.period);
  const conv = r.totals.conversions.toLocaleString("en-US");
  const spend = fmtMoney(r.totals.spend);
  const hitTarget = r.roas !== null && r.roas >= r.target_roas;
  const win = r.wins[0] ? stripDot(r.wins[0]) : null;
  const miss = r.misses[0] ? stripDot(r.misses[0]) : null;
  const next = r.next_actions[0] ? stripDot(r.next_actions[0]) : null;
  const draftsNote = r.findings.some((f) => f.rule === "low_ctr" || f.rule === "roas_below_1")
    ? "Any new ads are drafted and paused until you (or we) approve them."
    : null;

  let headline: string;
  let bullets: string[];
  let closing: string;
  if (s.email_style === "formal") {
    headline = `For the week of ${period}, the account generated ${conv} ${s.conversion_label} on ${spend} of spend, a return on ad spend of ${fmtRoas(r.roas)} against a target of ${r.target_roas.toFixed(1)}.`;
    bullets = [win && `Strongest result: ${lowerFirst(win)}.`, miss && `Area of concern: ${lowerFirst(miss)}.`, next && `Planned action: ${lowerFirst(next)}.`].filter(Boolean) as string[];
    closing = "The full one-page report is attached. Please let us know if you would like to discuss any of these items.";
  } else if (s.email_style === "plain") {
    headline = `Last week (${period}): ${conv} ${s.conversion_label} for ${spend}. ROAS ${fmtRoas(r.roas)}${hitTarget ? ", ahead of target." : `, under the ${r.target_roas.toFixed(1)} target.`}`;
    bullets = [win && `Working: ${lowerFirst(win)}.`, miss && `Not working: ${lowerFirst(miss)}.`, next && `What we're doing: ${lowerFirst(next)}.`].filter(Boolean) as string[];
    closing = "Report attached. Call me if you want to go through it.";
  } else {
    headline = `Quick recap for ${period}: ${conv} ${s.conversion_label} from ${spend} in spend, ROAS ${fmtRoas(r.roas)}${hitTarget ? " (ahead of target)." : ` (target ${r.target_roas.toFixed(1)}).`}`;
    bullets = [win && `Win: ${lowerFirst(win)}.`, miss && `Watching: ${lowerFirst(miss)}.`, next && `Next up: ${lowerFirst(next)}.`].filter(Boolean) as string[];
    closing = "The one-page report is attached.";
  }
  if (draftsNote) bullets.push(draftsNote);
  const body = [s.email_greeting, "", headline, "", ...bullets.map((b) => `- ${b}`), "", closing, "", s.email_signoff].join("\n");
  const subject = `${s.short_name} weekly ads recap · ${period}`;
  return { to: s.email_to, subject, body };
}

export async function writeRecapEmail(r: WeeklyReport, profile: ClientProfile): Promise<RecapEmail> {
  if (!isLive()) return { ...templateRecap(r, profile), written_by: modeLabel() };
  const system = fs.readFileSync(path.join(paths.prompts(), "recap-email.md"), "utf8");
  const out = await generateJson<{ subject: string; body: string }>({
    system,
    prompt: `<knowledge_profile>\n${profile.raw}\n</knowledge_profile>\n\n<report>\n${JSON.stringify(r, null, 2)}\n</report>`,
    schema: SCHEMA,
  });
  return { to: profile.settings.email_to, subject: out.subject, body: out.body, written_by: modeLabel() };
}

export function emailToMarkdown(e: RecapEmail): string {
  return `**To:** ${e.to}  \n**Subject:** ${e.subject}  \n_Draft written by: ${e.written_by}_\n\n---\n\n${e.body}\n`;
}
