import { prettyRange } from "./dates";
import { fmtMoney, fmtPct, fmtRoas } from "./format";
import type { WeeklyReport } from "./report";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Colors: categorical slots 1-2 for the two series; status colors (with icon + label) for flags. */
const C = {
  ink: "#0b0b0b",
  ink2: "#52514e",
  muted: "#8a8984",
  rule: "#e4e3df",
  surface: "#ffffff",
  panel: "#f6f6f4",
  spend: "#2a78d6",
  value: "#eb6834",
  good: "#0ca30c",
  goodText: "#006300",
  warning: "#fab219",
  warningText: "#8a5a00",
  critical: "#d03b3b",
};

function chart(daily: WeeklyReport["daily"], valueLabel: string): string {
  if (daily.length === 0) return "";
  const W = 330, H = 150, padL = 40, padB = 22, padT = 8;
  const max = Math.max(...daily.flatMap((d) => [d.spend, d.revenue]), 1);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const plotH = H - padB - padT;
  const groupW = (W - padL) / daily.length;
  const barW = Math.min(14, (groupW - 8) / 2);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];
  const bar = (x: number, v: number, color: string) => {
    const h = Math.max(1, (v / top) * plotH);
    const r = Math.min(4, barW / 2, h);
    const yTop = padT + plotH - h;
    // Rounded at the data end, square on the baseline.
    return `<path d="M${x},${padT + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${padT + plotH} Z" fill="${color}"/>`;
  };
  const bars = daily
    .map((d, i) => {
      const gx = padL + i * groupW + (groupW - (barW * 2 + 2)) / 2;
      const label = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      return `${bar(gx, d.spend, C.spend)}${bar(gx + barW + 2, d.revenue, C.value)}<text x="${gx + barW + 1}" y="${H - 6}" text-anchor="middle" class="ax">${label}</text>`;
    })
    .join("");
  const grid = ticks
    .map((t) => `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="${C.rule}" stroke-width="1"/><text x="${padL - 6}" y="${y(t) + 3}" text-anchor="end" class="ax">${fmtMoney(t)}</text>`)
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Daily spend and ${esc(valueLabel.toLowerCase())}">${grid}${bars}</svg>
  <div class="legend"><span><i style="background:${C.spend}"></i>Spend</span><span><i style="background:${C.value}"></i>${esc(valueLabel)}</span></div>`;
}

function flagChip(flag: "red" | "amber" | null): string {
  if (flag === "red") return `<span class="chip red">▲ Fix</span>`;
  if (flag === "amber") return `<span class="chip amber">● Check</span>`;
  return "";
}

export function renderReportHtml(r: WeeklyReport): string {
  const roasClass = (v: number | null) => (v === null ? "" : v < 1 ? "bad" : v >= r.target_roas ? "ok" : "");
  const kpis = r.kpis
    .map((k) => {
      const cls = k.good === null ? "flat" : k.good ? "up" : "down";
      const arrow = k.change_pct === null ? "" : k.change_pct > 0 ? "↑" : k.change_pct < 0 ? "↓" : "→";
      return `<div class="kpi"><div class="kl">${esc(k.label)}</div><div class="kv">${esc(k.value)}</div><div class="kd ${cls}">${k.change_pct === null ? "no prior data" : `${arrow} ${fmtPct(k.change_pct)} vs prior week`}</div></div>`;
    })
    .join("");
  const list = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  const rows = r.campaigns
    .map(
      (c) => `<tr class="${c.flag ?? ""}"><td>${esc(c.name)} ${flagChip(c.flag)}</td><td>${c.platform === "meta" ? "Meta" : "Google"}</td><td class="n">${fmtMoney(c.spend)}</td><td class="n">${c.conversions}</td><td class="n ${roasClass(c.roas)}">${fmtRoas(c.roas)}</td><td class="n">${fmtRoas(c.roas_prev)}</td></tr>`,
    )
    .join("");
  const brandLine = r.white_label ? `Prepared by ${esc(r.brand_as)}` : "Weekly paid media report";
  const footer = r.white_label
    ? `${esc(r.brand_as)} · Generated ${r.generated_at.slice(0, 10)}`
    : `Generated ${r.generated_at.slice(0, 10)} · Narrative: ${esc(r.written_by)} · Numbers pulled via the Ads Data MCP server · Sample data, fictional client`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.client_name)} weekly report</title>
<style>
  @page { size: Letter; margin: 0.45in 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", "Helvetica Neue", Arial, sans-serif; color: ${C.ink}; background: ${C.surface}; margin: 0; font-size: 10.5px; line-height: 1.4; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid ${C.ink}; padding-bottom: 8px; }
  h1 { font-size: 21px; margin: 0; letter-spacing: -0.01em; }
  .sub { color: ${C.ink2}; font-size: 11px; margin-top: 2px; }
  .period { text-align: right; font-size: 11px; color: ${C.ink2}; }
  .period b { display: block; color: ${C.ink}; font-size: 13px; }
  .summary { margin: 10px 0 10px; font-size: 11.5px; line-height: 1.5; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
  .kpi { background: ${C.panel}; border-radius: 6px; padding: 7px 8px; }
  .kl { color: ${C.ink2}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  .kv { font-size: 17px; font-weight: 700; margin: 2px 0; font-variant-numeric: tabular-nums; }
  .kd { font-size: 9px; color: ${C.ink2}; }
  .kd.up { color: ${C.goodText}; } .kd.down { color: ${C.critical}; }
  .row { display: grid; grid-template-columns: 1.05fr 1fr; gap: 14px; margin-top: 12px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 4px; color: ${C.ink2}; }
  .ax { font-size: 8px; fill: ${C.ink2}; }
  .legend { display: flex; gap: 12px; font-size: 9px; color: ${C.ink2}; margin-top: 2px; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  .pacing { margin-top: 8px; font-size: 10px; color: ${C.ink2}; }
  .bar { height: 6px; background: ${C.rule}; border-radius: 3px; margin-top: 3px; position: relative; }
  .bar span { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: ${C.ink2}; }
  .cols { display: grid; grid-template-columns: 1fr; gap: 7px; }
  .box { border-left: 3px solid ${C.rule}; padding: 2px 0 2px 9px; }
  .box.win { border-color: ${C.good}; } .box.miss { border-color: ${C.critical}; } .box.next { border-color: ${C.warning}; }
  .box h3 { margin: 0 0 2px; font-size: 11px; }
  .box ul { margin: 0; padding-left: 14px; } .box li { margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: ${C.ink2}; border-bottom: 1px solid ${C.ink}; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid ${C.rule}; }
  .n { text-align: right; } th.n { text-align: right; }
  td.bad { color: ${C.critical}; font-weight: 700; } td.ok { color: ${C.goodText}; font-weight: 600; }
  .chip { font-size: 8px; font-weight: 700; border-radius: 3px; padding: 1px 4px; margin-left: 4px; vertical-align: 1px; }
  .chip.red { background: ${C.critical}; color: #fff; } .chip.amber { background: ${C.warning}; color: ${C.ink}; }
  footer { margin-top: 10px; font-size: 8.5px; color: ${C.muted}; border-top: 1px solid ${C.rule}; padding-top: 5px; }
</style></head><body>
<header>
  <div><h1>${esc(r.client_name)}</h1><div class="sub">${brandLine}</div></div>
  <div class="period"><b>${esc(prettyRange(r.period))}</b>${esc(r.period.label)} vs previous 7 days</div>
</header>
<p class="summary">${esc(r.summary)}</p>
<div class="kpis">${kpis}</div>
<div class="row">
  <div>
    <h2>Daily spend vs ${esc(r.value_label.toLowerCase())}</h2>
    ${chart(r.daily, r.value_label)}
    <div class="pacing">Month to date: ${fmtMoney(r.pacing.spend_mtd)} of ${fmtMoney(r.pacing.monthly_budget)} · projected ${r.pacing.projected_pct_of_budget}% of budget
      <div class="bar"><span style="width:${Math.min(100, (r.pacing.spend_mtd / r.pacing.monthly_budget) * 100).toFixed(1)}%"></span></div></div>
  </div>
  <div class="cols">
    <div class="box win"><h3>✓ Wins</h3>${list(r.wins)}</div>
    <div class="box miss"><h3>✕ Misses</h3>${list(r.misses)}</div>
    <div class="box next"><h3>→ Next actions</h3>${list(r.next_actions)}</div>
  </div>
</div>
<table>
  <thead><tr><th>Campaign</th><th>Platform</th><th class="n">Spend</th><th class="n">${esc(r.conversion_label.replace(/^./, (c) => c.toUpperCase()))}</th><th class="n">ROAS</th><th class="n">Prior wk</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer>${footer}</footer>
</body></html>`;
}
