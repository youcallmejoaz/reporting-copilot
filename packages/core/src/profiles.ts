import fs from "node:fs";
import path from "node:path";
import { paths } from "./paths";
import type { ClientProfile, ProfileSettings } from "./types";

/** Minimal front-matter parser: flat `key: value` lines between `---` fences. */
export function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1 || line.trimStart().startsWith("#")) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body: raw.slice(m[0].length) };
}

function toSettings(clientId: string, d: Record<string, string>): ProfileSettings {
  const need = (k: string) => {
    if (!d[k]) throw new Error(`clients/${clientId}/profile.md is missing "${k}" in its front matter`);
    return d[k];
  };
  const style = need("email_style");
  if (style !== "friendly" && style !== "formal" && style !== "plain") {
    throw new Error(`clients/${clientId}/profile.md: email_style must be friendly, formal or plain`);
  }
  return {
    name: need("name"),
    short_name: d.short_name || need("name"),
    aliases: (d.aliases || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    target_roas: Number(need("target_roas")),
    monthly_budget: Number(need("monthly_budget")),
    naming_pattern: need("naming_pattern"),
    naming_example: d.naming_example || "",
    conversion_label: d.conversion_label || "conversions",
    email_to: d.email_to || "",
    email_style: style,
    email_greeting: d.email_greeting || "Hi,",
    email_signoff: (d.email_signoff || "Thanks").replace(/\\n/g, "\n"),
    brand_as: d.brand_as || "our team",
    white_label: d.white_label === "true",
  };
}

export function profilePath(clientId: string): string {
  if (!/^[a-z0-9-]+$/.test(clientId)) throw new Error(`Invalid client id "${clientId}"`);
  return path.join(paths.clients(), clientId, "profile.md");
}

export function loadProfile(clientId: string): ClientProfile {
  const p = profilePath(clientId);
  if (!fs.existsSync(p)) throw new Error(`No knowledge profile for client "${clientId}" (expected ${path.relative(process.cwd(), p)})`);
  const raw = fs.readFileSync(p, "utf8");
  const { data, body } = parseFrontMatter(raw);
  return { client_id: clientId, settings: toSettings(clientId, data), body, raw, path: p };
}

export function listProfileIds(): string[] {
  return fs
    .readdirSync(paths.clients(), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(paths.clients(), d.name, "profile.md")))
    .map((d) => d.name)
    .sort();
}
