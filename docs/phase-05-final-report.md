# Phase 5 — Generated Posts for Telegram, X, Instagram, and LinkedIn: Final Report

## Files created/changed (full paths)

**Commit 1 — shared**

- Created: `packages/shared/src/generated-posts.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — db**

- Created: `packages/db/src/repositories/generated-posts.ts`
- Modified: `packages/db/src/repositories/job-posts.ts`
- Modified: `packages/db/src/index.ts`

**Fix commit A**

- Modified: `packages/ai/src/rule-extractor.ts`

**Fix commit B**

- Modified: `packages/ai/src/rule-extractor.ts`

**Commit 3 — post-generator**

- Created: `packages/post-generator/package.json`
- Created: `packages/post-generator/tsconfig.json`
- Created: `packages/post-generator/src/index.ts`
- Created: `packages/post-generator/src/templates.ts`
- Created: `packages/post-generator/src/formatters.ts`
- Created: `packages/post-generator/src/generate-for-job.ts`
- Created: `packages/post-generator/src/generate-run.ts`
- Modified: `pnpm-lock.yaml`

**Commit 4 — worker**

- Modified: `apps/worker/src/index.ts`
- Modified: `apps/worker/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 5 — api**

- Created: `apps/api/src/routes/generated-posts.ts`
- Modified: `apps/api/src/index.ts`
- Modified: `apps/api/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 6 — web**

- Created: `apps/web/src/app/generated-posts/page.tsx`
- Modified: `apps/web/src/app/page.tsx`

**Commit 7 — docs**

- Created: `docs/05-post-generation.md`
- Modified: `README.md`

## Commands run

`pnpm install` (after each package/dependency change), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `pnpm --filter @foundryjobs/worker generate-posts:once` (without and with `DATABASE_URL`, multiple times), `node apps/api/dist/index.js` runtime smoke tests, `node apps/worker/dist/index.js` boot smoke test, `curl` against all Phase 0–5 endpoints, `next start` render tests for `/generated-posts` and `/`, `psql` verification queries against `foundryjobs_dev`, plus temporary smoke scripts (deleted, never committed) for repository checks and template checks, and one temporary maintenance script that refreshed stale qualification values in the scratch database after the extractor fixes.

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all ten workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `web`, `api`, `worker`); the final run reported 10 successful package typechecks with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## API smoke test results

Without `DATABASE_URL`: `GET /health` returns `{"ok":true,"service":"foundryjobs-api"}`; `GET /v1/generated-posts` returns HTTP 500 `{"error":{"message":"DATABASE_URL is required for generated post repository operations"}}`; `GET /v1/generated-posts?platform=bad` returns HTTP 400 with `platform must be one of: telegram, x, instagram, linkedin`; `POST /v1/job-posts/00000000-0000-4000-8000-000000000000/generate-posts` returns HTTP 500 with the same clear repository message; `POST /v1/job-posts/not-a-uuid/generate-posts` returns HTTP 400 `{"error":{"message":"id must be a valid UUID"}}`; the server shuts down gracefully; Phase 0–4 endpoints (`/v1/sources`, `/v1/raw-posts`, `/v1/job-posts`) still return their expected clear 500 responses without a database.

With `DATABASE_URL`: `GET /v1/generated-posts?limit=3` returned 3 drafts with platform, status `draft`, and previews; `GET /v1/generated-posts?platform=x` returned 3 rows; `POST /v1/job-posts/<already-generated-id>/generate-posts` returned `{"status":"skipped","generatedCount":0,"skippedReason":"Generated posts already exist for this job"}`; `POST /v1/job-posts/<non-eligible-id>/generate-posts` returned `{"status":"skipped","generatedCount":0,"skippedReason":"Job post is not flagged for posting (totalScore 49)"}`; deleting one job's drafts and calling the endpoint again returned `{"status":"generated","generatedCount":4}` and restored the total to 12.

## Worker generate-posts:once test result

Without `DATABASE_URL` it prints `DATABASE_URL is required to run generate-posts:once. Set it in the environment or the root .env file.` and exits 1. With the database, the first run printed `FoundryJobs generate-posts run complete (limit 25)` followed by `Processed 3 job posts (generated 3, skipped 0, errors 0)` with `generated=4` for each job. A second run printed `Processed 0 job posts (generated 0, skipped 0, errors 0)`, and the same zero-processed result was reproduced at final HEAD. The default worker boot still logs `FoundryJobs worker booted` and `No scheduled jobs registered yet`, and `fetch:once` and `normalize:once` remain unchanged.

## Eligible job posts

3 job posts were eligible (latest score `should_post = true`): Data Scientist - Client Platform (71), Software Engineer, Consumer Revenue (77), and Software Engineer, Safety Processing (75). This was verified both through `listJobPostsReadyForPostGeneration` and through SQL over the latest score per job.

## Generated posts created

12 `generated_posts` rows were created: 3 eligible jobs × 4 platforms, with exactly 4 rows for each of the 3 distinct job post ids and exactly 3 rows per platform (telegram, x, instagram, linkedin). Every row has `format_type = "single_job"`, `status = "draft"`, and `image_url = NULL`.

## Duplicate-skip behavior

Duplicate generation is prevented at two levels. The worker selection only returns jobs with no `generated_posts` rows, so the second run processed 0 jobs. Manually calling `POST /v1/job-posts/:id/generate-posts` on a job that already has drafts returns `status: "skipped"` with the reason `Generated posts already exist for this job`, and calling it on a non-eligible job returns `status: "skipped"` with the reason `Job post is not flagged for posting (totalScore 49)`. Deleting a job's 4 drafts and calling the endpoint again produced exactly 4 fresh drafts, returning the total to 12.

## X character length check result

The live X drafts measured 218, 237, and 238 characters. SQL confirmed `x_max = 237`, `x_over_280 = 0`, and `x_over_320 = 0`, so every X draft fits within the 280-character target and the 320-character fallback cap was never needed. A full scan for `null` or `undefined` substrings across all 12 draft bodies returned zero matches.

## OPENAI_API_KEY availability

No. `OPENAI_API_KEY` is unset, `GEMINI_API_KEY` is unset, and there is no root `.env` file, so no AI provider was called at any point. Deterministic templates were the only generator used, which matches the phase requirement that templates must work without any API key; OpenAI polishing was intentionally not implemented and is documented as deferred.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` currently holds 22 job posts, 22 scores, and the 12 generated drafts from this phase (plus the Phase 3/4 raw posts). It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## Commit hashes and messages

| Hash      | Message                                                      |
| --------- | ------------------------------------------------------------ |
| `23c0a24` | feat(shared): add generated post types and limits            |
| `bf15a66` | feat(db): add generated post repositories                    |
| `f46c26a` | fix(ai): tighten qualification matching and role categories  |
| `8eb3e41` | fix(ai): require education context for qualification matches |
| `a74de84` | feat(post-generator): add platform draft templates           |
| `77172ae` | feat(worker): add generate posts once command                |
| `d5c3421` | feat(api): add generated post endpoints                      |
| `8a4a171` | feat(web): add generated posts page                          |
| `9ab9f65` | docs: document post generation                               |

The two fix commits exist because template smoke testing surfaced Phase 4 rule-extractor bugs: the qualification pattern matched the verb "be" and the word "mastery", and role-category derivation tagged "Data Scientist - Client Platform" as DevOps. Both were fixed, and the affected scratch-database rows were refreshed with a one-off maintenance script.

## Known issues

1. The qualification fixes only affect newly extracted data, and the existing job posts in the scratch database were repaired through a one-off local maintenance script, so other environments with older data would still need a manual refresh or re-normalization.
2. The X fallback cap of 320 characters was never exercised because the longest live draft was 237 characters, so the very-long-URL path remains untested against real data.
3. The manual `POST /v1/job-posts/:id/generate-posts` endpoint exposes no regenerate option, so refreshing drafts for a job that already has them requires deleting the existing rows first.
4. Generation always creates all four platform drafts at once with no per-platform selection, so a job intended only for Telegram still consumes four `generated_posts` rows.
5. The ready-job selection relies on `DISTINCT ON` plus a `NOT EXISTS` check without a database uniqueness constraint, so two concurrent generation runs could still create duplicate drafts for the same job.
6. OpenAI polishing was not implemented even though the phase allowed it, so the `OPENAI_API_KEY` path is entirely unused and untested.
7. Drafts are truncated only as a safety net, and there is no post-insert verification step that re-checks Telegram, Instagram, and LinkedIn drafts against their platform limits.
8. The generated posts web page has no pagination controls and only displays the 20 most recent drafts.

## Next recommendations

- Build the Phase 6 approval queue so drafts can be approved, rejected, or edited before anything is published.
- Add a regenerate flag to the API endpoint and optional per-platform generation so drafts can be refreshed selectively.
- Add a test suite with fixture-based template assertions and repository integration tests against a disposable Postgres.
- Add a database-level idempotency guard (unique constraint or advisory lock) around generation for race-free behavior.
- Keep image generation and platform publishing (including `publish_events` writes) as separate later phases, then add scheduling once publishing exists.
