---
name: account-audit
description: Audit a paid media client's Meta and Google Ads account for wasted spend, ROAS under 1, ad sets overspending budget, campaign names that break the client's naming convention, low CTR creatives and monthly budget pacing. Use when asked to audit an account, "what's wrong with <client>", "anything I should fix", or before a client call.
---

# Account audit

Find what needs fixing in a client account and say exactly why, with the number that triggered it. The checks are deterministic (the `audit_account` MCP tool), so the same account always gives the same findings. Your job is to explain them, rank them and propose the fix.

## Steps

1. Call `audit_account {client_id}` on the `ads-data` MCP server. If the client is unclear, call `list_clients` first.
2. Read `client://<client_id>/profile` for context: targeting decisions you must not undo, budget rules (e.g. "hard cap"), naming convention.
3. Optionally call `find_underperformers` (defaults to the client's target ROAS) to add campaigns that are below target but not yet critical.
4. Report, red first:

   ```
   <Client> audit · <as-of date> · <n> red, <n> amber

   🔴 <entity name>: <reason with the number>
      Fix: <recommendation>
   🟠 ...

   Below target (not critical): ...
   ```

5. Offer fixes, never apply them:
   - For a low CTR creative or a ROAS < 1 campaign, offer `draft_ad_refresh`. It only creates a PAUSED draft that a human approves in the dashboard (Drafts page). Say that plainly.
   - Budget, status and naming changes are recommendations for the account manager. No tool can make them, by design.

## Rules and thresholds

| Rule | Severity | Trigger |
|---|---|---|
| ROAS under 1 | red | Campaign ROAS < 1.0 over the last 14 days (spend ≥ $100) |
| Wasted spend | red | Campaign spend ≥ $300 in the last 14 days with zero conversions |
| Overspend | red | Ad set average daily spend > 120% of its daily budget over the last 7 days |
| Broken naming | amber | Campaign name doesn't match the profile's `naming_pattern` |
| Low CTR | amber | Ad CTR < 0.5% on ≥ 5,000 impressions over the last 14 days |
| Budget pacing | amber | Projected month spend > 110% or < 85% of the monthly budget |

The live thresholds are in the `rules://audit` resource.

## Example

See `examples/sample-audits.md` for all four sample clients. Together they cover every planted problem.
