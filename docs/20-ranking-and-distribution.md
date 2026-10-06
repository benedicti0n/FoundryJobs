# Ranking and Distribution

This document covers the production source rollout, the eligibility model, deterministic ranking,
anti-dominance caps, and the Telegram Top-10 / Instagram+X Top-2 selection algorithms.

## 1. Production source rollout

- Migration `0002` (`category`, `region`, `priority` on `sources`) was applied to production Neon
  (3 migrations applied total; additive, no data touched).
- `pnpm sources:sync --env=production --dry-run` reported 59 added / 0 updated / 0 unchanged /
  0 deactivated; the real run added 59 active sources (big_tech 18, startup 10, yc 19, remote 4,
  mass_hiring 8), left all existing records untouched, and no demo/placeholder source is active.
- Figma, Clerk, and Discord received category metadata (`big_tech`, `startup`, `big_tech`).

## 2. Current scoring audit (pre-existing)

Scoring is per-job and immediate at normalization time (`packages/scoring`): freshness (20), fresher
fit (25), tech relevance (20), trust (20), remote (10), clarity (5); `shouldPost` requires
total >= 70, hiring + tech role, non-high spam risk, and min/max experience <= 3. Weaknesses found:
no explicit eligibility layer with reasons, no global ranking across jobs, no source-category or
region awareness, no company/source caps (a 300-job board can flood drafts), no media-worthiness
score, no publish-history awareness, coarse freshness buckets, and no India relevance signal.

## 3. Eligibility model

`evaluateEligibility(job)` returns `eligible | borderline | reject` with structured reason codes:

- Reject: seniority titles (senior/staff/principal/director/vp/head/chief, plus manager/lead except
  `associate product manager`-style early roles), required experience >= 5, non-tech roles.
- Borderline: required experience == 4.
- Positive: internship, fresher/new-grad wording, graduate programs, trainee/apprentice, junior or
  associate titles, required experience within 0-3 years, grad years 2025-2027, mass-hiring campaign
  wording.
- Missing experience, salary, or grad year never rejects; it only lowers confidence.

## 4. Experience normalization

`normalizeExperience(job)` produces `{ minYears, maxYears, level }` with levels `internship`,
`fresher` (max 0), `entry` (max 1), `early_career` (min <= 3 and max <= 3), `mid`, `senior`
(min >= 5), `unknown`. Required experience (min) dominates eligibility; preferred experience is not
separately extracted today.

## 5. Ranking model (0-100, deterministic)

| Dimension              | Max | Signals                                                      |
| ---------------------- | --- | ------------------------------------------------------------ |
| Audience fit           | 22  | eligibility status (eligible 22 / borderline 12 / reject 0)  |
| Experience fit         | 8   | normalized level (intern/fresher/entry 8 … senior 0)         |
| Role relevance         | 15  | legacy tech-relevance score                                  |
| Grad/fresher signals   | 10  | intern/fresher/trainee wording + 2025-2027 grad years        |
| India/remote relevance | 10  | India locations/region 10, remote 8, mixed 6, global 4       |
| Freshness              | 10  | <=24h 10, <=3d 8, <=7d 6, <=14d 3, older 1, unknown 5        |
| Source quality         | 10  | trust level + priority + bounded category bonus (max +2)     |
| Completeness           | 5   | apply URL, salary, skills, grad years                        |
| Mass-hiring/scale      | 5   | mass_hiring source **and** job-level fresher campaign signal |
| Media-worthiness       | 5   | scaled from the media score                                  |

Source prestige is bounded (max 10 of 100) so a strong fresher startup role outranks a mid-level
big-tech role. Every score returns a per-dimension breakdown.

## 6. Media score (0-100)

Eligibility relevance (25), title clarity (15), company recognizability/category (up to 22),
fresher/new-grad signals (15), freshness (10), visual/card completeness (10), remote/India
relevance (5). Missing apply URL or a rejected candidate forces media score 0 (not publishable).

## 7. Anti-dominance caps

Config (`packages/selection/src/config.ts`): `maxCandidatesPerCompany` 5, `maxCandidatesPerSource`
10, `maxTelegramPerCompany` 2, `maxMediaPerCompany` 1, `telegramMaxPosts` 10, `mediaMaxPosts` 2,
`repostExclusionDays` 30. Caps apply after dedupe and before ranking output, so a 300+ job source
cannot flood candidates or finals.

## 8. Telegram Top-10 algorithm

1. Exclude recently published jobs (successful publish event within 30 days).
2. Rank all candidates (eligibility + experience + quality score).
3. Dedupe by canonical apply URL, then company+title; direct ATS platforms beat RSS aggregators.
4. Cap per company (5) and per source (10).
5. Fill category slots: ~3 mass_hiring, ~2 big_tech, ~2 startup/YC, ~2 remote.
6. One wildcard (highest remaining).
7. Backfill remaining slots with the highest-scoring eligible jobs.
8. Never force a reject or low-quality job into a slot; company max 2.

Selections carry a `selectionReason` (`slot:*`, `wildcard:*`, `backfill:*`).

## 9. Instagram/X Top-2 algorithm

Top 2 by media score, excluding rejects, recently published jobs, and jobs without an apply URL;
max 1 per company; deterministic tie-breaks (quality score, then jobPostId). Instagram and X share
these two picks. Selection never publishes.

## 10. Mass-hiring treatment

Mass-hiring is a first-class bucket, but the boost applies only when the job itself shows broad
early-career signals (trainee/graduate/fresher wording or min experience <= 1). Generic senior
roles from mass-hiring sources get no boost. Indian IT-services employers (TCS, Infosys, Wipro,
Cognizant, etc.) still need portal discovery; ranking already supports the category.

## 11. Freshness and publish history

Freshness is bucketed by hours with unknown dates scored neutrally (5/10). `publish_events`
successes within the last 30 days exclude a job from both Telegram and media selection.

## 12. Preview command

```bash
pnpm jobs:select --env=dev [--limit=10] [--json]
pnpm jobs:select --env=production            # read-only, guarded against localhost
```

Prints the Telegram Top-10 and Media Top-2 tables (company, role, category, score, media score,
selection reason) plus near-miss counts (rejection reason distribution and the highest-scoring
unselected jobs). It never publishes and makes no provider calls.

## 13. Pending

- Wire selection into the publishing workflow (currently drafts are approved manually; selection is
  a preview/planning layer).
- Persist selection runs if replayable audit history becomes necessary.
- Fill the Indian IT-services mass-hiring gap via portal discovery.
