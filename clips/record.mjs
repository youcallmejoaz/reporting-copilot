#!/usr/bin/env node
/**
 * Records every demo clip at 1920x1080 with Playwright, then trims and converts to H.264 MP4 with ffmpeg.
 *
 *   npm run build            # the dashboard must be built
 *   node clips/record.mjs            # all clips + proposal cut + MANIFEST.md
 *   node clips/record.mjs C04 C10    # just these
 *
 * Uses sample data only. Starts its own dashboard on port 3200 with a throwaway database (clips/.state/).
 * App clips show a visible cursor and a highlight ring on every click; typing is human paced.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const CLIPS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(CLIPS, "..");
const RAW = path.join(CLIPS, "raw");
const STATE = path.join(CLIPS, ".state");
const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
// Pages are laid out at 1440x810 and zoomed 4/3, so the 1920x1080 recording is sharp (Playwright records CSS pixels).
const VIEWPORT = { width: 1920, height: 1080 };
const ZOOM = 4 / 3;
const SIZE = { width: 1920, height: 1080 };
const ZOOM_JS = `document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = '${ZOOM}'; });`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- cursor + click ring, injected into every app page ----------
const CURSOR_JS = `(() => {
  const install = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M5 2.5l14 8.2-6.3 1.6-3 6.2z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(' + (window.__cx ?? -100) + 'px,' + (window.__cy ?? -100) + 'px)' });
    document.documentElement.appendChild(c);
    const s = document.createElement('style');
    s.textContent = '@keyframes __ring{from{transform:translate(-50%,-50%) scale(.35);opacity:.95}to{transform:translate(-50%,-50%) scale(1.7);opacity:0}}.__ring{position:fixed;width:46px;height:46px;border-radius:50%;border:3px solid #1f6feb;background:rgba(31,111,235,.12);pointer-events:none;z-index:2147483646;animation:__ring .65s ease-out forwards}';
    document.documentElement.appendChild(s);
    // The overlay lives inside the zoomed page, so convert viewport coordinates back to page coordinates.
    const z = () => parseFloat(document.documentElement.style.zoom) || 1;
    addEventListener('mousemove', (e) => { window.__cx = e.clientX / z() - 4; window.__cy = e.clientY / z() - 2; c.style.transform = 'translate(' + window.__cx + 'px,' + window.__cy + 'px)'; }, true);
    addEventListener('mousedown', (e) => { const r = document.createElement('div'); r.className = '__ring'; r.style.left = e.clientX / z() + 'px'; r.style.top = e.clientY / z() + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 750); }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();`;

/** Human-ish pointer: glide to an element, pause, click (the ring shows), pause. */
function pointer(page) {
  let pos = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  const api = {
    async show() {
      await page.mouse.move(pos.x, pos.y);
    },
    async moveTo(locator, { dx = 0, dy = 0, steps = 28 } = {}) {
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      if (!b) throw new Error("element not visible");
      const to = { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy };
      await page.mouse.move(to.x, to.y, { steps });
      pos = to;
      await sleep(250);
    },
    async click(locator, opts) {
      await api.moveTo(locator, opts);
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
      await sleep(650);
    },
    async type(text, delay = 62) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        await sleep(delay + Math.random() * 40);
      }
    },
    async scroll(dy, steps = 12) {
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await sleep(45);
      }
      await sleep(300);
    },
  };
  return api;
}

/**
 * Close-ups: the clip is recorded full-frame, then ffmpeg zooms into the element's on-screen box
 * (animated over ~1.1 s, then held). Returns the box in video pixels.
 */
async function focusBox(locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("close-up target not visible");
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

function zoomFilter({ cx, cy }, scale) {
  // zoompan on a 2x upscale (less sub-pixel jitter). it = input timestamp; ease in over 1.1 s, then hold.
  const e = "min(it/1.1,1)";
  const Z = `(1+${scale - 1}*${e}*${e}*(3-2*${e}))`;
  const X = (cx * 2).toFixed(1);
  const Y = (cy * 2).toFixed(1);
  return [
    "scale=3840:2160:flags=lanczos",
    `zoompan=z='${Z}':x='max(0,min(iw-iw/zoom,${X}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${Y}-ih/zoom/2))':d=1:s=1920x1080:fps=30`,
  ].join(",");
}

// ---------- dashboard server ----------
async function startServer() {
  fs.rmSync(STATE, { recursive: true, force: true });
  fs.mkdirSync(STATE, { recursive: true });
  const env = {
    ...process.env,
    ARC_ROOT: ROOT,
    DB_PATH: path.join(STATE, "demo.db"),
    REPORTS_DIR: path.join(STATE, "reports"),
    DEMO_STAGE_DELAY_MS: "1400",
    ADS_ADAPTER: "mock",
    PORT: String(PORT),
  };
  delete env.DASHBOARD_PASSWORD;
  const proc = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: path.join(ROOT, "apps", "dashboard"), env, stdio: "ignore", detached: true });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc;
    } catch {
      /* starting */
    }
    await sleep(250);
  }
  stopServer(proc);
  throw new Error("Dashboard did not start. Run `npm run build` first.");
}

function stopServer(proc) {
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill();
  }
}

const latestRunId = async () => (await (await fetch(`${BASE}/api/runs`)).json())[0]?.id;

// ---------- clip definitions ----------
// target = final length in seconds. Each scenario calls mark() when the clip should start.
const cardUrl = (f) => `file://${path.join(CLIPS, "cards", f)}`;
const termUrl = (f) => `file://${path.join(CLIPS, "terminal", f)}`;

const CLIP_DEFS = [
  { id: "C01", slug: "messy_before", target: 8, section: "Problem", what: "Messy before state: spreadsheet with broken formulas, many ad-platform tabs, reporting clock ticking (animated card)", card: "C01_messy_before.html" },
  { id: "C02", slug: "flow", target: 10, section: "How it works", what: "Flow card: Ad accounts → Ads Data MCP server → Claude Skills → PDF reports → your review", card: "C02_flow.html" },
  {
    id: "C03", slug: "knowledge_folder", target: 8, section: "How it works", what: "Client knowledge folder: opening clients/ridgeline-roofing/profile.md (settings, accounts, naming, targeting, tone)",
    async run(page, p, mark) {
      await page.goto(`${BASE}/clients/glowfield-skincare`);
      await p.show();
      mark();
      await p.click(page.getByRole("link", { name: "📄 profile.md" }).nth(3));
      await page.waitForURL(/ridgeline-roofing/);
      await p.show();
      await sleep(900);
      await p.moveTo(page.locator(".fm"), { dy: -60 });
      await sleep(800);
      await p.scroll(520, 16);
      await sleep(600);
      await p.scroll(420, 14);
    },
  },
  {
    id: "C04", slug: "ask_roofing", target: 16, section: "How it works", what: "Asking “How did the roofing client do this month?”: the get_mtd_summary MCP tool call and an answer with real sample-data numbers",
    async run(page, p, mark) {
      await page.goto(`${BASE}/ask`);
      await p.show();
      mark();
      await sleep(500);
      await p.click(page.getByTestId("ask-input"));
      await p.type("How did the roofing client do this month?");
      await sleep(350);
      await p.click(page.getByTestId("ask-send"));
      await page.getByTestId("answer").waitFor();
      await sleep(1200);
      await p.moveTo(page.locator(".toolcall .tname"));
      await sleep(1300);
      await p.moveTo(page.getByTestId("answer").locator("li").nth(0), { dx: -120 });
      await sleep(700);
      await p.moveTo(page.getByTestId("answer").locator("li").nth(3), { dx: -120, steps: 40 });
    },
  },
  {
    id: "C05", slug: "closeup_numbers", target: 5, section: "How it works", what: "Close-up: the source tool call (get_mtd_summary, client_id ridgeline-roofing) and the month-to-date numbers",
    async run(page, p, mark) {
      await page.goto(`${BASE}/ask`);
      await page.getByTestId("ask-input").fill("How did the roofing client do this month?");
      await page.getByTestId("ask-send").click();
      await page.getByTestId("answer").waitFor();
      await sleep(400);
      const tool = await page.locator(".toolcall").boundingBox();
      const answer = await page.getByTestId("answer").locator("li").nth(2).boundingBox();
      const focus = { cx: tool.x + 560, cy: (tool.y + answer.y + answer.height) / 2 };
      await page.mouse.move(tool.x + 260, tool.y + 30, { steps: 1 });
      mark();
      await sleep(5200);
      return { focus, scale: 1.7 };
    },
  },
  {
    id: "C06", slug: "weekly_job_running", target: 10, section: "Demo", what: "Weekly job started from the dashboard: per-client progress (pulling via MCP → writing → rendering PDF → done)",
    async run(page, p, mark) {
      await page.goto(BASE);
      await p.show();
      mark();
      await sleep(400);
      await p.click(page.getByTestId("run-weekly"));
      await page.getByText("4/4 clients done").waitFor({ timeout: 60_000 });
      await sleep(400);
      await p.moveTo(page.getByTestId("run-item-ridgeline-roofing").getByRole("link", { name: /PDF/ }));
    },
  },
  {
    id: "C07", slug: "pdf_report", target: 16, section: "Demo", what: "Generated one-page PDF (Glowfield Skincare) opening in the browser’s PDF viewer, scrolling through KPIs, wins, misses, next actions and the campaign table",
    async run(page, p, mark) {
      const id = await latestRunId();
      await page.goto(`${BASE}/runs/${id}?client=glowfield-skincare`);
      await p.show();
      mark();
      await sleep(600);
      const open = page.getByTestId("open-pdf");
      await open.evaluate((a) => {
        a.removeAttribute("target");
        a.setAttribute("href", a.getAttribute("href") + "#zoom=135");
      });
      await p.click(open);
      await sleep(2600);
      await page.mouse.move(960, 560, { steps: 20 });
      for (const dy of [260, 240, 240, 260, 240]) {
        await sleep(1250);
        for (let i = 0; i < 10; i++) {
          await page.mouse.wheel(0, dy / 10);
          await sleep(30);
        }
      }
    },
  },
  {
    id: "C08", slug: "audit_flags", target: 10, section: "Demo", what: "Account audit flagging the ROAS-under-1 campaign (Glowfield) and the two broken campaign names (Ridgeline)",
    async run(page, p, mark) {
      await page.goto(`${BASE}/audit?client=glowfield-skincare`);
      await p.show();
      mark();
      await sleep(300);
      await p.click(page.getByTestId("run-audit"));
      await page.getByTestId("finding-roas_below_1").waitFor();
      await p.moveTo(page.getByTestId("finding-roas_below_1").locator(".reason"), { dx: -200 });
      await sleep(1300);
      await p.click(page.getByRole("link", { name: "Ridgeline Roofing Co." }));
      await page.waitForURL(/ridgeline/);
      await p.show();
      await sleep(300);
      await p.click(page.getByTestId("run-audit"));
      await page.getByTestId("finding-broken_naming").first().waitFor();
      await p.moveTo(page.getByTestId("finding-broken_naming").nth(1).locator(".name"));
    },
  },
  {
    id: "C09", slug: "closeup_red_flag", target: 5, section: "Demo", what: "Close-up: red flag on GF_META_PROS_BroadVideo with its reason (ROAS 0.62, $2,354 spend, $1,450 revenue) and the fix",
    async run(page, p, mark) {
      await page.goto(`${BASE}/audit?client=glowfield-skincare`);
      await page.getByTestId("run-audit").click();
      await page.getByTestId("finding-roas_below_1").waitFor();
      await sleep(300);
      const box = await page.getByTestId("finding-roas_below_1").boundingBox();
      const focus = { cx: box.x + 560, cy: box.y + box.height / 2 };
      await page.mouse.move(box.x + 300, box.y + box.height / 2 + 10, { steps: 1 });
      mark();
      await sleep(5200);
      return { focus, scale: 1.8 };
    },
  },
  {
    id: "C10", slug: "approve_draft", target: 16, section: "Safeguards", what: "Draft ad refresh shown as Paused (current vs proposed ad), Approve clicked, the approve_draft entry appears in the live audit log",
    async before() {
      await fetch(`${BASE}/api/drafts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: "northstar-partners", campaign_id: "cmp_np_01" }) });
    },
    async run(page, p, mark) {
      await page.goto(`${BASE}/drafts`);
      await p.show();
      mark();
      await sleep(600);
      await p.moveTo(page.getByTestId("draft-status").first());
      await sleep(1100);
      await p.moveTo(page.locator(".ad-preview").nth(1), { steps: 34 });
      await sleep(1300);
      await p.moveTo(page.locator(".paused-banner").first());
      await sleep(1200);
      await p.click(page.getByTestId("approve").first());
      await page.getByText("Approved · live").waitFor();
      await page.getByTestId("audit-log").getByText("approve_draft").first().waitFor();
      await sleep(500);
      await p.moveTo(page.getByTestId("audit-log").getByText("approve_draft").first(), { steps: 34 });
    },
  },
  {
    id: "C11", slug: "recap_email", target: 8, section: "Demo", what: "Recap email draft in the client’s saved tone: Harbor Law Group (formal, “Dear Ms. Shah”)",
    async run(page, p, mark) {
      const id = await latestRunId();
      await page.goto(`${BASE}/runs/${id}?client=glowfield-skincare`);
      await p.show();
      mark();
      await sleep(400);
      await p.click(page.getByRole("link", { name: "Harbor Law Group" }));
      await page.waitForURL(/harbor-law/);
      await p.show();
      await sleep(500);
      await p.moveTo(page.getByTestId("recap-email").locator(".email"), { dy: -120, dx: -150, steps: 30 });
      await sleep(1200);
      await p.moveTo(page.getByTestId("recap-email").locator(".email"), { dy: 40, dx: -150, steps: 40 });
    },
  },
  { id: "C12", slug: "prompt_plan", target: 10, section: "How I built it", what: "Prompt moment: the planning prompt typed in a dark terminal replay; the phased plan appears", term: "C12_prompt_plan.html" },
  { id: "C13", slug: "prompt_approval_gate", target: 8, section: "How I built it", what: "Prompt moment: “add the approval gate” prompt and the result (files changed, tests passing)", term: "C13_prompt_gate.html" },
  { id: "C14", slug: "safeguards", target: 8, section: "What could go wrong", what: "Safeguards card: paused by default, scoped tools, audit log, keys in env vars", card: "C14_safeguards.html" },
  { id: "C15", slug: "business_value", target: 10, section: "Business value", what: "Business value card: ~6 h of weekly reporting → ~30 min review pass (labelled placeholder numbers)", card: "C15_business_value.html" },
  { id: "C16", slug: "cost_estimate", target: 6, section: "Business value", what: "Running-cost card, labelled as an estimate (Claude API per client per week, hosting)", card: "C16_cost_estimate.html" },
];

const PROPOSAL = ["C01", "C04", "C07", "C10", "C15"];

// ---------- recording ----------
function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height:format=duration", "-of", "json", file]).toString();
  const j = JSON.parse(out);
  return { codec: j.streams[0].codec_name, width: j.streams[0].width, height: j.streams[0].height, duration: Number(j.format.duration) };
}

async function record(browser, def) {
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: RAW, size: SIZE } });
  await context.addInitScript(ZOOM_JS);
  if (!def.card && !def.term) await context.addInitScript(CURSOR_JS);
  const page = await context.newPage();
  const t0 = Date.now();
  let start = null;
  const mark = () => (start = (Date.now() - t0) / 1000);
  const p = pointer(page);

  let closeup = null;
  if (def.before) await def.before();
  if (def.card || def.term) {
    await page.goto(def.card ? cardUrl(def.card) : termUrl(def.term));
    mark();
    await sleep(def.target * 1000 + 600);
    if (def.card) await page.screenshot({ path: path.join(CLIPS, `${def.id}_${def.slug}.png`) });
  } else {
    closeup = await def.run(page, p, mark);
    // Hold on the final state until the clip reaches its target length.
    const elapsed = (Date.now() - t0) / 1000 - start;
    if (elapsed < def.target + 0.6) await sleep((def.target + 0.6 - elapsed) * 1000);
  }
  const end = (Date.now() - t0) / 1000;
  const video = page.video();
  await context.close();
  const raw = await video.path();
  const out = path.join(CLIPS, `${def.id}_${def.slug}.mp4`);
  // If the scenario ran long, keep the last `target` seconds' worth from the mark (trim dead time at the start only).
  const length = Math.max(def.target, 1);
  const from = Math.max(0, Math.min(start, end - length));
  ffmpeg(["-ss", from.toFixed(2), "-i", raw, "-t", String(length), "-an", "-vf", `fps=30,${closeup?.focus ? zoomFilter(closeup.focus, closeup.scale) : "scale=1920:1080:flags=lanczos"},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", out]);
  const info = probe(out);
  console.log(`${def.id} ${path.basename(out)} ${info.duration.toFixed(1)}s ${info.width}x${info.height} ${info.codec}`);
  return { ...def, file: path.basename(out), ...info };
}

function writeManifest(results) {
  const rows = CLIP_DEFS.map((d) => results.get(d.id)).filter(Boolean);
  const proposal = results.get("PROPOSAL");
  const md = [
    "# Clips manifest",
    "",
    "All clips: 1920×1080, H.264 (yuv420p, 30 fps), no audio, no watermark. Recorded with `clips/record.mjs` (Playwright) from the dashboard running on **fictional sample data**.",
    "App clips show a visible cursor with a highlight ring on every click; typing is human paced. Cards (C01, C02, C14, C15, C16) also have a PNG still. C12/C13 are stylized terminal replays of the build prompts (no keys, emails or personal paths).",
    "",
    "| Clip | File | Duration | What it shows | Script section |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.id} | \`${r.file}\`${r.card ? ` (+ \`${r.id}_${r.slug}.png\`)` : ""} | ${r.duration.toFixed(1)}s | ${r.what} | ${r.section} |`),
    "",
    "## Proposal cut",
    "",
    proposal
      ? `\`${proposal.file}\`: ${proposal.duration.toFixed(1)}s, clips ${PROPOSAL.join(" → ")} joined with straight cuts. C04, C07 and C10 run ~16 s (brief: 12 s) and C15 10 s (brief: 8 s) so the cut lands inside 60–90 s.`
      : "_Not built in this run._",
    "",
    "## Main video (4–7 min)",
    "",
    "The clips total about 2.5 minutes of footage. The main video is assembled in an editor with voice-over, using the script sections above in this order: Problem → How it works → Demo → Safeguards → What could go wrong → How I built it → Business value.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(CLIPS, "MANIFEST.md"), md);
}

function buildProposal(results) {
  const list = path.join(RAW, "proposal.txt");
  fs.writeFileSync(list, PROPOSAL.map((id) => `file '${path.join(CLIPS, results.get(id).file)}'`).join("\n"));
  const out = path.join(CLIPS, "P01_proposal_cut.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  const info = probe(out);
  console.log(`PROPOSAL ${path.basename(out)} ${info.duration.toFixed(1)}s`);
  return { file: path.basename(out), ...info };
}

// ---------- main ----------
const only = process.argv.slice(2).map((s) => s.toUpperCase());
const defs = only.length ? CLIP_DEFS.filter((d) => only.includes(d.id)) : CLIP_DEFS;
fs.mkdirSync(RAW, { recursive: true });
const server = await startServer();
// channel "chromium" = full Chromium in new headless mode (includes the PDF viewer used in C07).
const browser = await chromium.launch({ channel: "chromium" });
const results = new Map();
try {
  // C06 must run before the clips that open its run (C07, C11).
  const order = [...defs].sort((a, b) => (a.id === "C06" ? -1 : b.id === "C06" ? 1 : 0));
  if (!order.some((d) => d.id === "C06") && order.some((d) => d.id === "C07" || d.id === "C11")) {
    await fetch(`${BASE}/api/runs`, { method: "POST" });
    await sleep(9000);
  }
  for (const def of order) results.set(def.id, await record(browser, def));
  // Fill in clips recorded in earlier runs, then rebuild the proposal cut and manifest when every clip exists.
  for (const def of CLIP_DEFS) {
    const file = path.join(CLIPS, `${def.id}_${def.slug}.mp4`);
    if (!results.has(def.id) && fs.existsSync(file)) results.set(def.id, { ...def, file: path.basename(file), ...probe(file) });
  }
  if (CLIP_DEFS.every((d) => results.has(d.id))) {
    results.set("PROPOSAL", buildProposal(results));
    writeManifest(results);
  }
} finally {
  await browser.close();
  stopServer(server);
}
