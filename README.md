# FoundryJobs

Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.

FoundryJobs fetches hiring posts from trusted internet sources, filters and scores them with AI,
generates platform-specific posts for Telegram, X, Instagram, and LinkedIn, and keeps them in an
approval queue before anything is published.

**Current phase: Phase 10 — Buffer Publishing for X, Instagram, and LinkedIn.** The monorepo,
PostgreSQL schema, source registry, ATS fetchers (Greenhouse, Lever, Ashby), the normalization
pipeline, platform draft generation, the approval workflow, direct Telegram publishing,
deterministic Instagram card rendering, Cloudflare R2 uploads, and Buffer publishing for X,
Instagram, and LinkedIn are in place. Scheduling and authentication land in later phases.

## Requirements

- Node.js >= 20.9
- pnpm >= 10
- PostgreSQL 13+ (for `gen_random_uuid()`)

## Structure

- `apps/web` — Next.js dashboard (Tailwind, TypeScript)
- `apps/api` — Fastify API server
- `apps/worker` — background worker placeholder and one-time fetch command
- `packages/shared` — shared constants, types, DTOs, keywords, and validation helpers
- `packages/db` — Drizzle schema, migrations, repositories, and seed scripts
- `packages/fetchers` — ATS fetchers (Greenhouse, Lever, Ashby) and fetch runs
- `packages/ai` — job extraction with Gemini and a deterministic rules fallback
- `packages/scoring` — deterministic job scoring
- `packages/normalizer` — raw post normalization pipeline
- `packages/post-generator` — deterministic platform draft templates and generation runs
- `packages/telegram` — Telegram Bot API client and send helper
- `packages/publisher` — approved-draft publishing pipeline with publish_events recording
- `packages/card-renderer` — deterministic 1080x1080 Instagram job card renderer (SVG + sharp)
- `packages/storage` — Cloudflare R2 (S3-compatible) upload client
- `packages/card-uploader` — Instagram card upload pipeline from local files to R2
- `packages/buffer` — Buffer API client for X, Instagram, and LinkedIn publishing
- `packages/buffer-publisher` — approved-draft Buffer publishing pipeline
- `docs/` — project documentation

## Getting started

```bash
pnpm install
cp .env.example .env   # then set DATABASE_URL
pnpm db:migrate        # apply migrations
```

## Running apps

```bash
pnpm dev:web     # http://localhost:3000
pnpm dev:api     # http://localhost:4000
pnpm dev:worker  # boots the worker placeholder
pnpm dev         # all three in parallel

pnpm --filter @foundryjobs/worker fetch:once           # fetch all due sources once, then exit
pnpm --filter @foundryjobs/worker normalize:once       # normalize the next 25 new raw posts
pnpm --filter @foundryjobs/worker generate-posts:once  # generate drafts for ready job posts
pnpm --filter @foundryjobs/worker publish-telegram:once  # publish approved Telegram drafts
pnpm --filter @foundryjobs/worker render-instagram-cards:once  # render Instagram job cards
pnpm --filter @foundryjobs/worker upload-instagram-cards:once  # upload cards to Cloudflare R2
pnpm --filter @foundryjobs/worker publish-buffer:once  # publish approved X/Instagram/LinkedIn drafts via Buffer
```

The API serves `GET /health`, `GET /v1/status`, `GET /v1/db/status`, the source registry under
`/v1/sources`, raw/job post listings under `/v1/raw-posts` and `/v1/job-posts`, and generated post
listings under `/v1/generated-posts`.

## Workspace scripts

```bash
pnpm build      # build all apps
pnpm typecheck  # TypeScript checks across the workspace
pnpm lint       # ESLint across the workspace
pnpm format     # Prettier write
```

## Database

```bash
pnpm db:generate     # generate SQL migrations from the Drizzle schema
pnpm db:migrate      # apply migrations (requires DATABASE_URL)
pnpm db:studio       # open Drizzle Studio (requires DATABASE_URL)
pnpm db:seed:sources # insert starter sources (requires DATABASE_URL, idempotent)
```

Schema lives in `packages/db/src/schema`; migrations are written to `packages/db/drizzle`. See
[docs/01-database-schema.md](docs/01-database-schema.md) for the data model.

## Source registry

| Method | Path                     | Description                                                                |
| ------ | ------------------------ | -------------------------------------------------------------------------- |
| GET    | `/v1/sources`            | List sources (`type`, `platform`, `isActive`, `search`, `limit`, `offset`) |
| GET    | `/v1/sources/:id`        | Get one source                                                             |
| POST   | `/v1/sources`            | Create a source                                                            |
| PATCH  | `/v1/sources/:id`        | Partially update a source                                                  |
| PATCH  | `/v1/sources/:id/active` | Activate or pause a source                                                 |
| DELETE | `/v1/sources/:id`        | Delete a source                                                            |
| POST   | `/v1/sources/:id/fetch`  | Fetch one source now and store its raw posts                               |

Fetching is implemented for **Greenhouse, Lever, and Ashby** sources; other platforms can be
registered but are reported as `unsupported` until a fetcher is added. Fetch runs store raw posts in
`raw_posts` and deduplicate by content hash. There is no scheduler yet; use
`pnpm --filter @foundryjobs/worker fetch:once` or the per-source endpoint.

See [docs/02-source-registry.md](docs/02-source-registry.md) for types, platforms, and examples, and
[docs/03-fetching-pipeline.md](docs/03-fetching-pipeline.md) for the fetching pipeline.

## Normalization

| Method | Path                          | Description                                              |
| ------ | ----------------------------- | -------------------------------------------------------- |
| GET    | `/v1/raw-posts`               | List raw posts (`status`, `sourceId`, `limit`, `offset`) |
| POST   | `/v1/raw-posts/:id/normalize` | Normalize one raw post now                               |
| GET    | `/v1/job-posts`               | List normalized job posts with latest score              |

Extraction uses Gemini when `GEMINI_API_KEY` is set; otherwise a deterministic rules fallback runs,
so local development needs no API key. `GEMINI_MODEL` is optional and defaults to
`gemini-2.5-flash-lite`. See
[docs/04-normalization-and-scoring.md](docs/04-normalization-and-scoring.md) for the pipeline,
scoring components, and `shouldPost` logic.

## Post generation

| Method | Path                               | Description                                                        |
| ------ | ---------------------------------- | ------------------------------------------------------------------ |
| GET    | `/v1/generated-posts`              | List drafts (`jobPostId`, `platform`, `status`, `limit`, `offset`) |
| POST   | `/v1/job-posts/:id/generate-posts` | Generate drafts for one scored job post                            |

Drafts are produced by deterministic templates (no OpenAI key required) for Telegram, X, Instagram,
and LinkedIn, and stored with status `draft`. **Nothing is published yet**: there are no Telegram, X,
Instagram, or LinkedIn API calls. See
[docs/05-post-generation.md](docs/05-post-generation.md) for templates, platform rules, and X
character limits.

## Approval queue

| Method | Path                               | Description                                  |
| ------ | ---------------------------------- | -------------------------------------------- |
| GET    | `/v1/approval-queue`               | List drafts waiting for review               |
| GET    | `/v1/generated-posts/:id`          | Fetch one generated post                     |
| PATCH  | `/v1/generated-posts/:id/text`     | Edit draft text without changing its status  |
| POST   | `/v1/generated-posts/:id/approval` | Approve, reject, or request edits on a draft |

Approved and rejected drafts leave the default queue, and every decision is recorded in the
`approvals` table. The dashboard page at `/approval-queue` can now edit draft text and approve,
reject, or mark drafts as needing work directly in the browser; it needs `API_BASE_URL` and records
decisions as `decidedBy: dashboard`. See [docs/06-approval-queue.md](docs/06-approval-queue.md) for
the lifecycle and [docs/11-dashboard-approval-actions.md](docs/11-dashboard-approval-actions.md) for
the dashboard actions.

## Telegram publishing

| Method | Path                                       | Description                         |
| ------ | ------------------------------------------ | ----------------------------------- |
| GET    | `/v1/publish-events`                       | List delivery attempts and results  |
| POST   | `/v1/generated-posts/:id/publish/telegram` | Publish one approved Telegram draft |

Only approved Telegram drafts are published, using `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Every
attempt is recorded in `publish_events`; successful posts are marked `published` and failed Telegram
sends are marked `failed`. The publish endpoints have no authentication yet, so do not expose them
publicly. See [docs/07-telegram-publishing.md](docs/07-telegram-publishing.md) for the flow,
idempotency rules, and safety notes.

## Instagram cards

| Method | Path                                            | Description                                   |
| ------ | ----------------------------------------------- | --------------------------------------------- |
| POST   | `/v1/generated-posts/:id/render/instagram-card` | Render a 1080x1080 card for an Instagram post |

Cards are rendered deterministically from an SVG template and rasterized with `sharp` (no browser
and no AI image generation). PNGs are written to `apps/web/public/generated/instagram-cards/` and
served at `/generated/instagram-cards/...`; they are local files for now and are not uploaded to
R2. `regenerate: true` in the request body overwrites an existing card. See
[docs/08-instagram-card-renderer.md](docs/08-instagram-card-renderer.md) for the design and flow.

## R2 uploads

| Method | Path                                            | Description                    |
| ------ | ----------------------------------------------- | ------------------------------ |
| POST   | `/v1/generated-posts/:id/upload/instagram-card` | Upload one rendered card to R2 |

Uploads require `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and
`R2_PUBLIC_BASE_URL`. Successful uploads replace the local `/generated/...` path in
`generated_posts.image_url` with the public R2 URL at the key
`foundryjobs/instagram-cards/instagram-card-<id>.png`. Instagram publishing is still separate and not
implemented. See [docs/09-r2-instagram-card-upload.md](docs/09-r2-instagram-card-upload.md) for the
flow and API behaviors.

## Buffer publishing

| Method | Path                                     | Description                                     |
| ------ | ---------------------------------------- | ----------------------------------------------- |
| POST   | `/v1/generated-posts/:id/publish/buffer` | Publish one approved X/Instagram/LinkedIn draft |

Buffer publishing requires `BUFFER_ACCESS_TOKEN` plus the matching `BUFFER_PROFILE_ID_X`,
`BUFFER_PROFILE_ID_INSTAGRAM`, or `BUFFER_PROFILE_ID_LINKEDIN` value. Only approved posts are
published, Instagram requires a public `http(s)` image URL (upload the card to R2 first), and every
attempt is recorded in the shared `publish_events` audit trail. Telegram stays on its direct bot
pipeline and is never routed through Buffer. See
[docs/10-buffer-publishing.md](docs/10-buffer-publishing.md) for the flow and API behaviors.

## Documentation

- [Project overview](docs/00-project-overview.md)
- [Database schema](docs/01-database-schema.md)
- [Source registry](docs/02-source-registry.md)
- [Fetching pipeline](docs/03-fetching-pipeline.md)
- [Normalization and scoring](docs/04-normalization-and-scoring.md)
- [Post generation](docs/05-post-generation.md)
- [Approval queue](docs/06-approval-queue.md)
- [Telegram publishing](docs/07-telegram-publishing.md)
- [Instagram card renderer](docs/08-instagram-card-renderer.md)
- [R2 Instagram card uploads](docs/09-r2-instagram-card-upload.md)
- [Buffer publishing](docs/10-buffer-publishing.md)
- [Dashboard approval actions](docs/11-dashboard-approval-actions.md)
