# Handoff: how this works, in plain English

This is for a teammate who will run it day to day. No coding needed for the normal workflow.

## The idea

Claude acts like a junior on the team who:

1. **Reads the ad accounts** through a connector (the "Ads Data MCP server") instead of clicking around Ads Manager.
2. **Knows each client** from a one-page profile: targets, naming rules, what we decided about targeting, how they like reports, how to talk to them.
3. **Follows our playbooks** (the three Skills): weekly report, recap email, account audit.
4. **Never changes a live ad.** It can only draft new ads, and they're created paused. You approve them.

## Your weekly routine

**Monday morning** the weekly job runs by itself (or click **▶ Run weekly reports** on the dashboard home page).

1. Open the dashboard → **Weekly reports**. Each client goes Pulling data → Writing report → Rendering PDF → Done.
2. Click **Open run**, pick a client, and check:
   - the **PDF** (one page: KPIs, chart, wins, misses, next actions, campaign table)
   - the **recap email draft** next to it. It's a draft: copy it into your email client, attach the PDF and send it yourself.
3. Go to **Draft approvals**. Every proposed new ad shows the current ad next to the proposed one and why. Click **Approve** to set it live or **Reject** to keep it off. Either way it's logged.
4. If something looks off, go to **Account audit**, pick the client and click **Run audit**. Red = fix now, amber = check.

## Asking questions

Dashboard → **Ask**, or in Claude Code / Claude Desktop once connected. Examples:

- "How did the roofing client do this month?"
- "Anything wrong with the law firm account?"
- "Which skincare campaigns are underperforming?"
- "Draft a creative refresh for the white label account" (creates a paused draft for you to approve)

Every answer shows which tool it called, so you can see where the numbers came from.

## Updating what Claude knows about a client

Edit `clients/<client>/profile.md`. The block at the top (between the `---` lines) holds the settings the system reads: target ROAS, monthly budget, naming rule, email greeting and sign-off, white-label flag. The rest is plain notes Claude reads before writing anything. Changes apply on the next run, with no restart.

To add a client: copy a folder in `clients/`, change the values, and add the account to the ad platform adapter (or to the sample data while testing).

## Things that are deliberately impossible

- Claude cannot set an ad live, pause or edit an existing ad, or change a budget. No tool for it exists.
- The weekly job only has read access.
- White-label reports (Northstar) never mention our agency, our tools or AI.

## When something breaks

| Symptom | Check |
|---|---|
| A client shows **Failed** in a run | Hover the red pill for the error. Usually a typo in that client's `profile.md` front matter. |
| Reports say "test mode" in the footer | No `ANTHROPIC_API_KEY` set. Numbers are still correct; only the wording is template-based. |
| Claude Desktop can't see the tools | Run `npm run build:mcp` again and restart Claude Desktop. |
| Need to know who approved something | **Audit log** page, or the `audit_log` table in the SQLite file. |
