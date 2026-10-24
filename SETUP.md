# Setup guide

## 1. Install

Requirements: Node.js 22.5+ (uses the built-in `node:sqlite`). Chromium for PDFs comes with Playwright:

```bash
npm install
npx playwright install chromium   # skip if Chromium is already installed for Playwright 1.63
cp .env.example .env              # optional: add ANTHROPIC_API_KEY
npm test
```

## 2. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | empty | Empty = test mode (template wording). Set it to have Claude write reports, emails, ad copy and Ask answers. |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model for all Claude calls. |
| `ADS_ADAPTER` | `mock` | `mock` = sample data. `google_ads` / `meta` are stubs until implemented. |
| `AS_OF_DATE` | `2026-10-22` with mock data, else yesterday | Last complete day of data. "This month" / "last 7 days" end here. |
| `MCP_SCOPES` | `read,draft` | `read` = reporting tools only. Add `draft` for paused draft ads. |
| `DB_PATH` | `./data/copilot.db` | SQLite file for runs, drafts and the audit log. |
| `REPORTS_DIR` | `./reports` | Where PDFs and recap drafts go. |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | empty | Basic auth for the dashboard. Always set when deployed. |
| `CRON_SECRET` | empty | Bearer token the scheduler uses for `POST /api/runs`. |

## 3. Connect Claude

### Claude Code
`.mcp.json` already registers the server. Open the repo in Claude Code, approve the `ads-data` server, and the three skills in `.claude/skills` load automatically. Try:

- "How did the roofing client do this month?"
- "/account-audit harbor-law"
- "Write the weekly report for Glowfield"

### Claude Desktop
Build the bundled server once, then add it to `claude_desktop_config.json` (Settings → Developer → Edit config):

```bash
npm run build:mcp
```

```json
{
  "mcpServers": {
    "ads-data": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/reporting-copilot/packages/mcp-server/dist/index.js"],
      "env": { "MCP_SCOPES": "read" }
    }
  }
}
```

Use `"read"` in Desktop unless you want Claude to draft ads there too. Skills: zip each folder in `skills/` and upload it under Settings → Capabilities → Skills.

## 4. Schedule the weekly job

Pick one:

- **Server cron:** `0 7 * * 1 cd /path/to/repo && npm run weekly >> reports/cron.log 2>&1`
- **Deployed dashboard:** `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/runs` (the Render blueprint does this every Monday 07:00 UTC).

## 5. Deploy the dashboard (Render)

`render.yaml` defines:

- a Docker web service (Playwright base image, so PDF rendering works) with a 1 GB persistent disk at `/var/data` for SQLite and PDFs. Persistent disks need a paid instance (Starter, about $7/month).
- a cron service that triggers the weekly run.

Steps: push the repo to GitHub → Render → New → Blueprint → pick the repo → fill in `ANTHROPIC_API_KEY`, `DASHBOARD_USER`, `DASHBOARD_PASSWORD` and the cron's `DASHBOARD_URL` (your service URL).

Why not Vercel: serverless functions have no persistent disk, so SQLite runs, drafts and the audit log would be lost, and Chromium is awkward there. To use Vercel anyway, swap SQLite for a hosted database (e.g. Turso) and move PDF rendering to a separate worker.

## 6. Going live with real ad accounts

1. Implement `packages/core/src/adapters/google-ads.ts` and `meta.ts`. The comments list the exact API fields. For clients on both platforms, add a small composite adapter that merges the two.
2. Keep `createPausedAd` creating ads with status PAUSED (Google `PAUSED`, Meta `status=PAUSED`). `activateAd` is only called from the dashboard approval.
3. Put credentials in env vars (see `.env.example`), set `ADS_ADAPTER`, and remove `AS_OF_DATE` so reports run up to yesterday.
4. Replace the placeholder account IDs in `clients/*/profile.md`.
