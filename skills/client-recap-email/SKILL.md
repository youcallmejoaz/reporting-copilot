---
name: client-recap-email
description: Draft the weekly recap email for a paid media client in that client's saved tone (greeting, sign-off, formality, white-label rules from their knowledge profile). Use when asked to write, draft or update a client recap, weekly update email or results email. Drafts only, never sends.
---

# Client recap email

Draft the weekly email that goes out with the PDF report, in the client's voice. Draft only: never send email or claim it was sent.

## Steps

1. Read `client://<client_id>/profile` from the `ads-data` MCP server. Take from the front matter and the Tone section:
   - `email_to`, `email_greeting`, `email_signoff`, `email_style` (friendly / formal / plain)
   - `brand_as` and `white_label` (white label = sign as the client's brand, never mention our agency, tools, MCP or Claude)
   - any length or jargon rules (e.g. "under 150 words", "say people who clicked, not CTR")
2. Get the week's facts:
   - If this week's job already ran, read `reports/<date>/<client_id>.json` (it holds the report the PDF was made from).
   - Otherwise call `get_campaign_metrics` (`last_7d` and `prev_7d`) and `audit_account`.
3. Write the email following `packages/core/prompts/recap-email.md`:
   - Subject under 70 characters with the date range.
   - Greeting, a one-line headline result, 2-4 short bullets (win, miss, what we're doing next), note that the PDF is attached, sign-off.
   - Only numbers from the tool output or report JSON.
   - Ad changes are "drafted and paused until approved", never "live".
4. Output exactly:

   ```
   To: <email_to>
   Subject: <subject>

   <body>
   ```

## Tone cheat sheet (sample clients)

| Client | Style | Greeting | Notes |
|---|---|---|---|
| Glowfield Skincare | friendly | Hi Maya, | Upbeat, no jargon, under 150 words, read on a phone |
| Ridgeline Roofing | plain | Dave, | Numbers first, short sentences, no marketing jargon |
| Harbor Law Group | formal | Dear Ms. Shah, | Full sentences, no exclamation marks or emoji; budget is a hard cap |
| Northstar Partners | friendly, white label | Hi Sam, | Sign as "Northstar Partners Paid Media"; written so Sam can forward it as-is |

## Examples

- `examples/harbor-law-formal.md`
- `examples/ridgeline-roofing-plain.md`
- `examples/northstar-white-label.md`
