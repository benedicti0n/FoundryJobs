# Scheduler Orchestration

Phase 12 adds a scheduler mode to the worker that runs the non-publishing FoundryJobs pipeline on a
recurring basis. Publishing stays manual and is never scheduled.

## Purpose

Until now every pipeline step required a manual `*:once` command. The scheduler turns the safe,
idempotent steps into a long-running loop so a single worker process can keep sources fresh, keep
raw posts normalized, keep drafts generated, and keep Instagram cards rendered and uploaded while
humans focus on review and publishing.

## Scheduled jobs

| Job                      | Default interval | Interval env var                             | Limit env var                     | Default limit |
| ------------------------ | ---------------- | -------------------------------------------- | --------------------------------- | ------------- |
| `fetch_due_sources`      | 30 minutes       | `SCHEDULER_FETCH_INTERVAL_MINUTES`           | —                                 | —             |
| `normalize_raw_posts`    | 15 minutes       | `SCHEDULER_NORMALIZE_INTERVAL_MINUTES`       | `SCHEDULER_NORMALIZE_LIMIT`       | 25            |
| `generate_posts`         | 15 minutes       | `SCHEDULER_GENERATE_POSTS_INTERVAL_MINUTES`  | `SCHEDULER_GENERATE_POSTS_LIMIT`  | 25            |
| `render_instagram_cards` | 30 minutes       | `SCHEDULER_RENDER_IG_CARDS_INTERVAL_MINUTES` | `SCHEDULER_RENDER_IG_CARDS_LIMIT` | 10            |
| `upload_instagram_cards` | 30 minutes       | `SCHEDULER_UPLOAD_IG_CARDS_INTERVAL_MINUTES` | `SCHEDULER_UPLOAD_IG_CARDS_LIMIT` | 10            |

The job list, defaults, and env var names also live in `packages/shared/src/scheduler.ts` and are
reported (configuration only) by `GET /v1/scheduler/status` and the `/scheduler` dashboard page.

## Environment variables

| Variable                 | Default | Purpose                                                        |
| ------------------------ | ------- | -------------------------------------------------------------- |
| `SCHEDULER_ENABLED`      | `false` | Must be `true` for the scheduler command to start.             |
| `SCHEDULER_RUN_ON_START` | `false` | Run every job once immediately on boot, in pipeline order, before intervals begin. |

Missing `DATABASE_URL` is fatal when the scheduler is enabled and the process exits 1 with a clear
message. Missing `R2_*` variables are not fatal: the upload job is skipped with
`R2 is not configured; upload skipped` and the scheduler keeps running. Missing `GEMINI_API_KEY` is
not fatal because the normalizer falls back to the deterministic rules extractor. Telegram and
Buffer variables are irrelevant because publishing is not scheduled.

## Why publishing is not scheduled

Publishing is the only irreversible step in the pipeline, and every platform integration in this
repo is still untested against real credentials. The scheduler therefore refuses to include
`publish-telegram:once`, `publish-buffer:once`, or any publish endpoint; publishing remains a manual
action after human approval. This also keeps the blast radius of a misconfigured scheduler to new
rows and files it creates locally, never public posts.

## Running the scheduler

```bash
# Start the scheduler (only runs when explicitly enabled)
SCHEDULER_ENABLED=true pnpm --filter @foundryjobs/worker scheduler

# Run every job once in pipeline order, then keep scheduling
SCHEDULER_ENABLED=true SCHEDULER_RUN_ON_START=true pnpm --filter @foundryjobs/worker scheduler

# Shorter intervals for testing (values are minutes and accept fractions)
SCHEDULER_ENABLED=true SCHEDULER_FETCH_INTERVAL_MINUTES=0.5 pnpm --filter @foundryjobs/worker scheduler
```

Behavior guarantees:

- with `SCHEDULER_ENABLED` unset or false the command prints `FoundryJobs scheduler is disabled.`
  and exits 0 without starting anything;
- with `SCHEDULER_RUN_ON_START=true` the startup pass runs the jobs sequentially in dependency order
  (fetch, normalize, generate, render, upload) instead of firing them all at once, so a single boot
  completes the full chain: posts fetched on boot are normalized and drafted, and cards rendered on
  boot are uploaded, without waiting for the next interval;
- recurring interval ticks stay independent per job, so the schedule remains best-effort and
  eventually consistent outside the startup pass;
- a job never overlaps with itself; ticks that fire while the same job is running are skipped with
  `still running; skipping overlapping tick`;
- a failing job is logged with its error and does not stop the scheduler or future runs;
- `SIGINT` and `SIGTERM` stop the timers, wait for in-flight jobs to finish, close the database
  pool, and exit 0.

## Manual once commands

Every scheduled job can still be run by hand, one step at a time:

```bash
pnpm --filter @foundryjobs/worker fetch:once
pnpm --filter @foundryjobs/worker normalize:once
pnpm --filter @foundryjobs/worker generate-posts:once
pnpm --filter @foundryjobs/worker render-instagram-cards:once
pnpm --filter @foundryjobs/worker upload-instagram-cards:once
```

Publishing remains manual as well:

```bash
pnpm --filter @foundryjobs/worker publish-telegram:once
pnpm --filter @foundryjobs/worker publish-buffer:once
```

## Deployment note

Run exactly one scheduler instance per environment. There are no distributed locks yet, so two
schedulers pointed at the same database would duplicate work: overlapping fetches would both hit
source APIs, and renders/uploads could race on the same rows (dedupe by content hash keeps fetches
safe, but the rest is best-effort). Keep the scheduler on a single worker process and scale other
one-shot commands separately.

## Non-goals for this phase

- No automatic publishing of any kind.
- No distributed locking or leader election between worker instances.
- No authentication; the `/scheduler` page and `GET /v1/scheduler/status` are read-only.
- No AI image generation and no new platform APIs.
