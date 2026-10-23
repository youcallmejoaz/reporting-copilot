---
name: Glowfield Skincare
short_name: Glowfield
aliases: glowfield, skincare, skin care, ecommerce
target_roas: 3.0
monthly_budget: 12500
naming_pattern: ^GF_(META|GGL)_(PROS|RET|SHOP|BRAND|SRCH|PMAX)_[A-Za-z0-9]+$
naming_example: GF_META_RET_Cart30d
conversion_label: purchases
email_to: Maya Lin (Head of Growth)
email_style: friendly
email_greeting: Hi Maya,
email_signoff: Talk soon,\nThe paid media team
brand_as: our team
---

# Glowfield Skincare

Fictional client. All IDs below are placeholders.

## Accounts

| Platform | Account ID | Notes |
|---|---|---|
| Meta Ads | act_000000000101 | Pixel + Conversions API live |
| Google Ads | 000-000-0101 | Merchant Center feed `GF-US-main` |

## Business context

- DTC skincare, average order value about **$58**.
- Goal: **ROAS 3.0+** blended. Founder cares about new-customer growth but will not fund unprofitable prospecting for long.
- Monthly media budget: **$12,500** (Meta ~45%, Google ~55%).

## Naming convention

`GF_<PLATFORM>_<OBJECTIVE>_<Descriptor>`

- PLATFORM: `META` or `GGL`
- OBJECTIVE: `PROS` (prospecting), `RET` (retargeting), `SHOP` (Shopping), `BRAND`, `SRCH`, `PMAX`
- Descriptor: PascalCase, no spaces. Example: `GF_META_RET_Cart30d`
- Ads: `<Format>_<Angle>_v<n>` e.g. `Video_UGC_MorningRoutine_v1`

## Targeting decisions (do not undo without asking)

- Prospecting runs **broad, women 25-54, US**, plus one skincare-interest stack. No lookalikes (tested Q2, worse CPA).
- Retargeting windows: cart 30d, product viewers 30d. Exclude purchasers 180d.
- Brand search kept on exact + phrase with a low budget cap.

## Report format

- One page. Lead with blended ROAS vs the 3.0 target, then spend, purchases, CPA.
- Wins / misses / next actions, max 3 bullets each.
- Call out any campaign below 1.0 ROAS in red.

## Tone

Friendly, upbeat, first names, no jargon. Maya reads on her phone, so keep the recap email under 150 words.
