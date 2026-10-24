# Clips manifest

All clips: 1920×1080, H.264 (yuv420p, 30 fps), no audio, no watermark. Recorded with `clips/record.mjs` (Playwright) from the dashboard running on **fictional sample data**.
App clips show a visible cursor with a highlight ring on every click; typing is human paced. Cards (C01, C02, C14, C15, C16) also have a PNG still. C12/C13 are stylized terminal replays of the build prompts (no keys, emails or personal paths).

| Clip | File | Duration | What it shows | Script section |
|---|---|---|---|---|
| C01 | `C01_messy_before.mp4` (+ `C01_messy_before.png`) | 8.0s | Messy before state: spreadsheet with broken formulas, many ad-platform tabs, reporting clock ticking (animated card) | Problem |
| C02 | `C02_flow.mp4` (+ `C02_flow.png`) | 10.0s | Flow card: Ad accounts → Ads Data MCP server → Claude Skills → PDF reports → your review | How it works |
| C03 | `C03_knowledge_folder.mp4` | 8.0s | Client knowledge folder: opening clients/ridgeline-roofing/profile.md (settings, accounts, naming, targeting, tone) | How it works |
| C04 | `C04_ask_roofing.mp4` | 16.0s | Asking “How did the roofing client do this month?”: the get_mtd_summary MCP tool call and an answer with real sample-data numbers | How it works |
| C05 | `C05_closeup_numbers.mp4` | 5.0s | Close-up: the source tool call (get_mtd_summary, client_id ridgeline-roofing) and the month-to-date numbers | How it works |
| C06 | `C06_weekly_job_running.mp4` | 10.0s | Weekly job started from the dashboard: per-client progress (pulling via MCP → writing → rendering PDF → done) | Demo |
| C07 | `C07_pdf_report.mp4` | 16.0s | Generated one-page PDF (Glowfield Skincare) opening in the browser’s PDF viewer, scrolling through KPIs, wins, misses, next actions and the campaign table | Demo |
| C08 | `C08_audit_flags.mp4` | 10.0s | Account audit flagging the ROAS-under-1 campaign (Glowfield) and the two broken campaign names (Ridgeline) | Demo |
| C09 | `C09_closeup_red_flag.mp4` | 5.0s | Close-up: red flag on GF_META_PROS_BroadVideo with its reason (ROAS 0.62, $2,354 spend, $1,450 revenue) and the fix | Demo |
| C10 | `C10_approve_draft.mp4` | 16.0s | Draft ad refresh shown as Paused (current vs proposed ad), Approve clicked, the approve_draft entry appears in the live audit log | Safeguards |
| C11 | `C11_recap_email.mp4` | 8.0s | Recap email draft in the client’s saved tone: Harbor Law Group (formal, “Dear Ms. Shah”) | Demo |
| C12 | `C12_prompt_plan.mp4` | 10.0s | Prompt moment: the planning prompt typed in a dark terminal replay; the phased plan appears | How I built it |
| C13 | `C13_prompt_approval_gate.mp4` | 8.0s | Prompt moment: “add the approval gate” prompt and the result (files changed, tests passing) | How I built it |
| C14 | `C14_safeguards.mp4` (+ `C14_safeguards.png`) | 8.0s | Safeguards card: paused by default, scoped tools, audit log, keys in env vars | What could go wrong |
| C15 | `C15_business_value.mp4` (+ `C15_business_value.png`) | 10.0s | Business value card: ~6 h of weekly reporting → ~30 min review pass (labelled placeholder numbers) | Business value |
| C16 | `C16_cost_estimate.mp4` (+ `C16_cost_estimate.png`) | 6.0s | Running-cost card, labelled as an estimate (Claude API per client per week, hosting) | Business value |

## Proposal cut

`P01_proposal_cut.mp4`: 65.9s, clips C01 → C04 → C07 → C10 → C15 joined with straight cuts. C04, C07 and C10 run ~16 s (brief: 12 s) and C15 10 s (brief: 8 s) so the cut lands inside 60–90 s.

## Main video (4–7 min)

The clips total about 2.5 minutes of footage. The main video is assembled in an editor with voice-over, using the script sections above in this order: Problem → How it works → Demo → Safeguards → What could go wrong → How I built it → Business value.
