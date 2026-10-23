---
name: weekly-roas-report
description: Write the one-page weekly ROAS report (PDF) for one or all paid media clients, with wins, misses and next actions. Use when asked for a weekly report, client report, "how did <client> do last week", or to prepare reports for review. Pulls every number through the ads-data MCP server.
---

# Weekly ROAS report

Produce a one-page PDF per client: KPIs vs the previous week, a daily spend chart, wins, misses, next actions and a campaign table. You write the words; the numbers always come from the `ads-data` MCP tools.

## Before you start

- The `ads-data` MCP server must be connected (tools `get_campaign_metrics`, `get_mtd_summary`, `audit_account`). If it is not, stop and say so. Never estimate numbers.
- Data runs to the as-of date in the server instructions (sample data: 2026-10-22). "Last week" = the 7 days ending on that date.

## Steps (per client)

1. Identify the client. If unclear, call `list_clients` and ask.
2. Read the knowledge profile resource `client://<client_id>/profile`. Note the target ROAS, what the report should lead with, the tone, and any white-label rule.
3. Pull the data:
   - `get_campaign_metrics` with `date_range: "last_7d"`, `include_daily: true`
   - `get_campaign_metrics` with `date_range: "prev_7d"`
   - `get_mtd_summary`
   - `audit_account`
4. Write the narrative as JSON, following `packages/core/prompts/weekly-report.md`:
   ```json
   { "summary": "...", "wins": ["..."], "misses": ["..."], "next_actions": ["..."] }
   ```
   - Summary: 2-3 sentences, lead with what the profile says to lead with.
   - Wins / misses: max 3 each, one sentence, each with a number from the tool output.
   - Next actions: max 4, concrete, for this week. Ad changes are drafted PAUSED for review. Never say anything is live.
   - Any campaign with ROAS under 1.0 and every red audit finding is a miss.
   - White-label clients: never mention the agency, tools, MCP or Claude.
5. Render the PDF (Claude Code, from the repo root):
   ```bash
   npx tsx scripts/render-report.ts --client <client_id> --narrative /tmp/<client_id>-narrative.json
   ```
   It writes `reports/manual/<client_id>.pdf` using the same numbers from the MCP tools, so your narrative and the table can never disagree.
6. Reply with the PDF path and a 3-line summary. In Claude Desktop (no shell), show the report as a formatted page instead and say the PDF is produced by the weekly job.

## All clients at once

For "run the weekly reports", run the scheduled job instead of looping by hand:

```bash
npm run weekly
```

It writes `reports/YYYY-MM-DD/<client_id>.pdf` plus a recap email draft for every client and shows progress in the dashboard.

## Quality checks before you hand it over

- Every number in your text appears in the tool output (same rounding).
- Wins, misses and actions are each 3 or fewer (actions 4 or fewer); the PDF must stay one page.
- Tone and lead metric match the profile.

## Example

See `examples/ridgeline-roofing.md` for the tool calls, the narrative JSON and the resulting report for the roofing client.
