# Example: Ridgeline Roofing, week of Oct 16-22, 2026 (sample data)

**Request:** "Do the weekly report for the roofing client."

## Tool calls

1. Resource `client://ridgeline-roofing/profile` → lead with lead count and cost per lead, plain-spoken, target ROAS 4.0.
2. `get_campaign_metrics {client_id: "ridgeline-roofing", date_range: "last_7d", include_daily: true}`
   → spend $2,443 · 29 leads · $84.23 per lead · modelled value $13,214 · ROAS 5.41
3. `get_campaign_metrics {client_id: "ridgeline-roofing", date_range: "prev_7d"}` → ROAS 5.66 the week before
4. `get_mtd_summary {client_id: "ridgeline-roofing"}` → pacing to 97.5% of the $11,000 budget
5. `audit_account {client_id: "ridgeline-roofing"}` → 2 amber findings: campaign names "roof ads new FINAL" and "Copy of RR_META_LEADS_Homeowners" break the naming convention

## Narrative JSON written by the skill

```json
{
  "summary": "29 leads last week at $84 each, from $2,443 in spend. That's a 5.41 return on the $450 lead value, comfortably above the 4.0 target, and the month is on track at 97.5% of budget.",
  "wins": [
    "Roof repair search was the best campaign again: 11 leads from $686 (6.95 ROAS).",
    "Spend stayed flat week over week ($2,443) while the account held well above target."
  ],
  "misses": [
    "Roof replacement search slipped to 2.73 ROAS on $842, below the 4.0 target.",
    "Leads dipped 6.5% versus the week before (29 vs 31)."
  ],
  "next_actions": [
    "Move about $15/day from roof replacement to roof repair search.",
    "Rename \"roof ads new FINAL\" and \"Copy of RR_META_LEADS_Homeowners\" to the RR_ naming convention so they show up in reports.",
    "Draft a fresh replacement ad (left paused for your review)."
  ]
}
```

## Render

```bash
npx tsx scripts/render-report.ts --client ridgeline-roofing --narrative /tmp/ridgeline-roofing-narrative.json
# Wrote reports/manual/ridgeline-roofing.pdf
```
