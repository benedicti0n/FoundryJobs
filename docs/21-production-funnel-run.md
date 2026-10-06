# First Production Funnel Run (source → normalize → score → selection)

Read-only funnel validation against production Neon after the 59-source rollout. **Nothing was
published; no scheduler; no Buffer/Telegram/SuperProfile/X/Instagram calls.**

## Pre-flight

Production Neon (`neondb`): 59 active sources (big_tech 18, startup 10, yc 19, remote 4,
mass_hiring 8), 0 raw posts, 1 job_post / 1 job_score / 1 generated_post / 3 approvals /
3 publish_events, no scheduler or worker processes running.

## Fetch pass

One controlled pass (interrupted once by a tool timeout after 10 sources, then resumed — same
logical pass; already-fetched sources are not due again):

- **59/59 sources succeeded, 0 failed, 0 unsupported**
- **6,776 raw posts inserted**, all `new`; duplicate rate ~1.9%
- Category mix: big_tech 3,468 · yc 1,447 · startup 690 · mass_hiring 618 · remote 553
- Largest sources: Canonical 300, Datadog 300, Elastic 300, Databricks 300, MongoDB 300,
  Cloudflare 299, Stripe 298, Brex 284, Roblox 254, OpenAI 250

Raw quality checks: 0 missing URLs, 0 duplicate URLs, 0 empty/HTML titles, 0 tiny bodies. Title
mix: ~60% senior/management wording, 322 fresher/intern/graduate titles, ~42% non-tech wording —
all left to the eligibility layer rather than source-level filtering. No source was broken or
deactivated.

## Normalization (bounded, stratified)

Two bounded batches, round-robin across all 59 sources (max 10 per source), categories balanced:

| Batch     | Processed | Normalized | Rejected | Errors |
| --------- | --------- | ---------- | -------- | ------ |
| 1         | 200       | 15         | 185      | 0      |
| 2         | 250       | 18         | 222      | 10     |
| **Total** | **450**   | **33**     | **407**  | **10** |

- Model `gemini-3.5-flash-lite`; **440 successful calls**, 704,297 input / 30,888 output tokens,
  avg 1,403 ms. Estimated cost ≈ $0.29 at standard rates (~$0.15 batch tier).
- The 10 errors are **HTTP 402 "prepayment credits depleted"** — the Gemini key is out of credits.
  They were recorded as `error` and not retried. After topping up credits, reset with:
  `update raw_posts set status='new', error_message=null where status='error' and fetched_at >= '<fetch timestamp>';`
- Rejection reasons sampled look correct: senior/manager roles, non-tech roles, and postings with
  no verifiable 0-3 YOE requirement.

## Normalized pool audit (34 jobs incl. the pre-existing imported one)

- Eligibility: **eligible 31, reject 3** (all `senior_title`); no borderline.
- Experience levels: internship 16, early_career 16, entry 2 — strongly early-career.
- Categories: mass_hiring 11, big_tech 10, yc 5, startup 4, remote 3, imported 1.
- Grad years: 2027 ×9; India-relevant 3; remote 13; missing apply/location/experience: 0.

## Selection before tuning (real output)

Problems observed: a German-language Bosch posting ranked #1 and led media; Bosch took two of the
three mass-hiring slots with a German/English near-duplicate pair; a "High School Internship"
outranked university-grad roles.

## Tuning (evidence-driven, with regression tests)

1. **Non-English posting penalty** — titles matching German/French internship wording lose 8 quality
   points and 15 media points (`language_penalty` breakdown entry). Fixes the German Bosch posting.
2. **Slot company diversity** — each category slot first fills with distinct companies before
   allowing a second job from the same company. Fixes the Bosch double-slot.
3. **High-school cap** — "high school" internships cap their fresher-signal contribution at 4/10.

## Selection after tuning (real production output, read-only)

```
TELEGRAM TOP 10
1  Bosch Group | Internship Agentic AI ...            | mass_hiring | 86 | slot:mass_hiring
2  Intel       | Technology Research 2D Transistor... | mass_hiring | 76 | slot:mass_hiring
3  Micron      | Singapore Campus Hiring              | mass_hiring | 71 | slot:mass_hiring
4  Pinterest   | UX Quantitative Research Intern      | big_tech    | 84 | slot:big_tech
5  Roblox      | Software Engineer Intern             | big_tech    | 77 | slot:big_tech
6  Ramp        | Software Engineering Intern, iOS     | yc          | 77 | slot:startup_yc
7  PostHog     | Product Engineer                     | yc          | 75 | slot:startup_yc
8  Canonical   | Ubuntu Linux Kernel Engineer ...     | remote      | 73 | slot:remote
9  GitLab      | Tech Operations Specialist           | remote      | 69 | slot:remote
10 Bosch Group | Mandatory Internship Automotive...   | mass_hiring | 86 | wildcard

MEDIA TOP 2
1  Pinterest | UX Quantitative Research Intern | big_tech    | 84 | media 83
2  Bosch     | Internship Agentic AI ...       | mass_hiring | 86 | media 81
```

Exclusions: 1 recent-publish, 2 duplicates, 0 cap-excluded, 3 eligibility rejects.

Remaining review notes (no further tuning): Intel's 2D-transistor research role is niche but
extracted as 0-3 YOE; Canonical kernel/silicon role is niche-remote; Pinterest UX research is
product-adjacent rather than engineering; Micron's campus-hiring role is Singapore-based. None
clearly violate eligibility.

## Remaining backlog and blockers

- 6,326 `new` raw posts + 10 `error` posts remain unnormalized (normalization stopped because the
  Gemini key ran out of prepaid credits). Roughly 7-8% of a future batch is expected to normalize.
- Recommendation: top up Gemini credits, then continue bounded stratified batches; re-run
  `pnpm jobs:select --env=production` afterwards. The ranking layer is ready to wire into the
  publishing workflow once a representative pool exists — do not enable the scheduler yet.
