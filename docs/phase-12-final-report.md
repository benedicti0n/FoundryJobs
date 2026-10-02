# Phase 12 — Scheduler / Cron Orchestration: Final Report

## Files created/changed (full paths)

**Commit 1 — shared**

- Created: `packages/shared/src/scheduler.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — worker**

- Created: `apps/worker/src/jobs.ts`

**Commit 3 — worker**

- Created: `apps/worker/src/scheduler.ts`
- Modified: `apps/worker/src/index.ts`
- Modified: `apps/worker/package.json`

**Commit 4 — api**

- Created: `apps/api/src/routes/scheduler.ts`
- Modified: `apps/api/src/index.ts`

**Commit 5 — web**

- Created: `apps/web/src/app/scheduler/page.tsx`
- Modified: `apps/web/src/app/page.tsx`

**Commit 6 — docs**

- Created: `docs/12-scheduler.md`
- Modified: `README.md`

## Commands run

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `pnpm --filter @foundryjobs/worker scheduler` (disabled mode; enabled without `DATABASE_URL`), `node apps/worker/dist/index.js scheduler` (live runs with `SCHEDULER_ENABLED=true`, `SCHEDULER_RUN_ON_START=true`, and a short `SCHEDULER_FETCH_INTERVAL_MINUTES=0.05` interval to exercise the overlap guard), `SIGTERM` shutdown tests, `pnpm --filter @foundryjobs/worker normalize:once` and `generate-posts:once` regressions, `node apps/worker/dist/index.js` default boot, `node apps/api/dist/index.js` runtime smoke tests, `curl` against `/health`, `/v1/scheduler/status`, `/v1/approval-queue`, and `/v1/generated-posts`, `next start` render tests for `/scheduler` and `/`, `psql` state verification against `foundryjobs_dev`, and temporary smoke scripts inside `apps/worker` (deleted, never committed).

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all seventeen workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `telegram`, `publisher`, `card-renderer`, `storage`, `card-uploader`, `buffer`, `buffer-publisher`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## Scheduler disabled-mode test result

With `SCHEDULER_ENABLED` unset, `pnpm --filter @foundryjobs/worker scheduler` printed `FoundryJobs scheduler is disabled. Set SCHEDULER_ENABLED=true to enable scheduled jobs.` and exited 0 without starting any timers.

## Scheduler missing-DATABASE_URL test result

With `SCHEDULER_ENABLED=true` and no `DATABASE_URL`, the command printed `DATABASE_URL is required to run the scheduler. Set it in the environment or the root .env file.` and exited 1 before any job ran.

## Scheduler run-on-start test result

With `DATABASE_URL`, `SCHEDULER_ENABLED=true`, and `SCHEDULER_RUN_ON_START=true`, the scheduler booted with `FoundryJobs scheduler booted`, listed all five jobs and intervals, and ran one cycle of every job: `fetch_due_sources success — sources 3 (success 3, failed 0, unsupported 0); posts fetched 64, inserted 3, duplicates 61` in the first (short-interval) test; `normalize_raw_posts success — processed 0 ... using rules`; `generate_posts success — processed 0 jobs`; `render_instagram_cards success — processed 0 cards`; and `upload_instagram_cards skipped — R2 is not configured; upload skipped`. The short-interval test also produced `fetch_due_sources is still running; skipping overlapping tick` twice, proving the overlap guard. `SIGTERM` logged `FoundryJobs scheduler received SIGTERM, shutting down`, waited for the in-flight fetch to finish (12.6 seconds), and exited cleanly with no leftover process. At final HEAD a default-interval run reproduced the same clean cycle with `sources 0` (nothing due) in about 60 ms per job.

## Whether any publishing command was invoked

No publishing command was invoked. A grep for `publish-telegram`, `publish-buffer`, `publish/telegram`, and `publish/buffer` across the scheduler logs returned zero matches, and the scheduler job registry contains only the five non-publishing jobs.

## Existing worker command regression results

The default worker mode still logs `FoundryJobs worker booted` / `No scheduled jobs registered yet`. `normalize:once` with `DATABASE_URL` still works and processed the three new raw posts created by the scheduler fetch test (`Processed 3 raw posts (normalized 1, rejected 2, errors 0)`). `generate-posts:once` without `DATABASE_URL` still exits 1 with the clear message. All other once commands remain registered unchanged.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–12 state: 64 raw posts (all processed), 22 job posts, 22 scores, 12 generated posts (4 approved, 5 draft, 3 rejected), 10 approval rows, and 0 publish events. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## R2 env availability

No. All `R2_*` variables are unset, so the upload job reported `R2 is not configured; upload skipped` instead of failing, which is exactly the configured fallback behavior.

## Commit hashes and messages

| Hash      | Message                                |
| --------- | -------------------------------------- |
| `53f1289` | feat(shared): add scheduler types      |
| `575ae70` | feat(worker): add reusable job runners |
| `481b735` | feat(worker): add scheduler mode       |
| `cdb73df` | feat(api): add scheduler info endpoint |
| `88d15d8` | feat(web): add scheduler info page     |
| `a08aa5c` | docs: document scheduler orchestration |

## Known issues

1. There is no distributed lock or leader election, so two scheduler instances pointed at the same database would duplicate work.
2. Live scheduler state exists only inside the worker process and its logs, and `GET /v1/scheduler/status` reports static configuration defaults rather than actual run history.
3. Scheduler intervals are read from environment variables once at boot, so changing an interval requires restarting the worker.
4. The overlap guard prevents a job from overlapping itself but allows different jobs to run concurrently, which can interleave database writes from fetch, normalize, and generate steps.
5. `SCHEDULER_RUN_ON_START` fires every job at once on boot, which on a large backlog could spike CPU and API traffic with no stagger or warm-up.
6. Failed jobs are logged and the loop continues, but there is no failure counter or backoff, so a permanently broken job is retried on every interval forever.
7. The scheduler command has no dry-run mode, so exercising a schedule without side effects requires pointing at a scratch database.
8. The scheduler test cycle performed a real fetch that inserted three new raw posts, demonstrating that even the safe jobs mutate state and need production discipline.

## Next recommendations

- Add authentication and then define a single-instance deployment story for the scheduler (for example one worker service per environment).
- Proceed to Phase 13: either dashboard publish buttons for approved drafts or a publish-all orchestration, keeping publishing manual by default.
- Add failure counters and backoff, and consider a small scheduler_runs table so run history survives process restarts.
- Consider a reload mechanism (for example SIGHUP) so intervals can change without a restart.
- Add a `--once` or dry-run flag to the scheduler for safer operational testing.
