# Selection-to-Approval Pipeline (Non-Live Wiring)

## Telegram mass-hiring classification (fixed)

The alert precedence previously treated 0–1 YOE as a mass-hiring signal, which mislabeled junior
startup roles as "🔥 Mass Hiring". Mass hiring is now derived only from `sourceCategory =
mass_hiring` or explicit campaign wording (mass/bulk/campus hiring, graduate hiring drive,
multiple openings, large-scale hiring, walk-in, batch/cohort hiring). Precedence: mass hiring →
internship → fresher → remote → big tech → startup/YC → generic. Regression tests cover the
0–1 YOE startup case, explicit campaign wording, and mass-hiring sources.

## Company logos

`pnpm companies:sync-logos --env=dev|test|production [--dry-run] [--yes] [--refresh]` resolves and
validates company logos, then upserts `companies.logo_url` (never deletes; updates only when empty,
invalid, or `--refresh`).

Findings from live ATS probing: Greenhouse board APIs expose no logo, SmartRecruiters has no public
company endpoint, and Ashby board pages expose only a **shared platform default** favicon
(`cdn.ashbyprd.com/cdn_assets/<platform-hash>/...`) identical across companies. The sync tool
detects shared assets (used by more than one company) and treats them as unresolved rather than
attaching the wrong logo. Result on production: **57 companies, 0 resolved, 0 invalid, 57
unresolved** — ATS metadata does not carry company-specific logos, so Telegram posts publish
text-only until curated `companies.logo_url` entries are added (the sync tool will then validate and
persist them idempotently).

## Cheap pre-AI relevance filter

`classifyRelevance` buckets raw titles into `likely_relevant` / `uncertain` / `likely_irrelevant`
and `prioritizeByRelevance` orders normalization candidates so AI calls spend on fresher/intern/
graduate/analyst signals first, senior titles last. "Member of Technical Staff" stays uncertain,
and associate product manager remains possible. Used by `normalizeNewRawPosts`.

## Ranking: geography and education narrowness

`classifyIndiaAccessibility` distinguishes india / remote_india / remote_global /
global_unspecified / restricted_non_india / unknown and feeds ranking points (India 10, remote
worldwide 8, unspecified 5, restricted 3). PhD/doctoral/high-school-specific titles receive modest
penalties (quality −6, media −10) but stay eligible.

## Selection-driven draft generation

`pnpm jobs:generate-selected --env=dev|test|production` runs the deterministic selection and calls
`generatePostsForSelection({ telegramJobIds, mediaJobIds })`, creating Telegram drafts for the Top
10 and Instagram drafts for the Top 2 (X only when `FEATURE_X_PUBLISHING_ENABLED=true`). Selection
is stateless but deterministic; generation is idempotent per `(job_post_id, platform)` with active
statuses (draft/approved/published) blocking duplicates, so no selection-run persistence table is
required — rerunning the same selection produces zero duplicates. Selection-vetted jobs bypass the
legacy `shouldPost` gate (`skipScoreGate`), which remains in place for manual generation.

Production result: **10 Telegram drafts + 2 Instagram drafts, 0 X drafts**; rerun skipped all;
historical rows untouched.

## Instagram keywords and SuperProfile preparation

Migration `0003` adds `trigger_keyword`, `automation_status` (default `not_provisioned`) and
`automation_id` to `generated_posts`. Instagram drafts receive a deterministic trigger keyword:
uppercase display / lowercase normalized, company-based, generic words (LINK/FREE/GUIDE/JOBS/
HIRING) avoided, collisions resolved with a role shorthand then numeric suffix, unique across active
Instagram drafts. The keyword is stored for later use by the card CTA, caption, and SuperProfile
comment trigger. No SuperProfile writes occur; every Instagram draft stays `not_provisioned` with a
null automation id until the live phase.

Banner asset (`imageAssetId 545433f5…`) could not be verified through the currently granted MCP
read APIs — manual confirmation/upload in the SuperProfile UI is required. `FOUNDRYJOBS_TELEGRAM_URL`
is set to `https://t.me/foundry_jobs`.

## Normalization status (blocked)

Gemini preflight still returns **HTTP 402 (prepayment credits depleted)**. No new normalization
batches or error resets were performed; the 10 `error` raw posts remain queued for reset after
credits are restored. Selection was validated on the existing 34-job production pool.

## Safety

No Telegram sends, no Buffer createPost, no Instagram/X publishes, no SuperProfile writes, no
scheduler. Historical `publish_events` (3) and `approvals` (3) are unchanged; new draft rows only.
