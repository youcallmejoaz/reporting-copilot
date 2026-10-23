---
name: Ridgeline Roofing Co.
short_name: Ridgeline
aliases: ridgeline, roofing, roofer, roof
target_roas: 4.0
monthly_budget: 11000
naming_pattern: ^RR_(META|GGL)_(SRCH|LEADS|RET|PMAX|DISP)_[A-Za-z0-9]+$
conversion_label: leads
email_to: Dave Romero (Owner)
email_style: plain
email_greeting: Dave,
email_signoff: Thanks,\nThe paid media team
brand_as: our team
---

# Ridgeline Roofing Co.

Fictional client. All IDs below are placeholders.

## Accounts

| Platform | Account ID | Notes |
|---|---|---|
| Google Ads | 000-000-0202 | Call + form conversions imported from CRM |
| Meta Ads | act_000000000202 | Instant forms, CRM sync via webhook |

## Business context

- Residential roofing, 25 mile service area.
- Lead value modelled at **$450** (close rate × average job margin). "Revenue" in reports = leads × $450.
- Target **ROAS 4.0** on modelled lead value. Monthly budget **$11,000**.
- Storm season (Sep-Nov) gets priority on the storm damage campaign.

## Naming convention

`RR_<PLATFORM>_<OBJECTIVE>_<Descriptor>`

- PLATFORM: `META` or `GGL`
- OBJECTIVE: `SRCH`, `LEADS`, `RET`, `PMAX`, `DISP`
- Never leave "Copy of", "new", "FINAL" or spaces in a campaign name.

## Targeting decisions

- Search: exact + phrase only. Broad match was paused in July (junk leads).
- Meta: homeowners 35-65, 25mi radius, plus a 2% lookalike of past customers.
- Exclude zip codes outside the service area (list lives in the Google Ads shared library).

## Report format

- One page. Lead count and cost per lead first, then modelled ROAS.
- Dave wants to know: how many leads, what they cost, what we're changing.

## Tone

Plain-spoken and practical. Short sentences. No marketing jargon (say "people who clicked", not "CTR"). Numbers first.
