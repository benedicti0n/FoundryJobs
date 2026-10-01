# FoundryJobs

Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.

FoundryJobs fetches hiring posts from trusted internet sources, filters and scores them with AI,
generates platform-specific posts for Telegram, X, Instagram, and LinkedIn, and keeps them in an
approval queue before anything is published.

**Current phase: Phase 6 — Approval Queue.** The monorepo, PostgreSQL schema, source registry, ATS
fetchers (Greenhouse, Lever, Ashby), the normalization pipeline, platform draft generation, and the
approval workflow (approve, reject, or request edits) are in place. Publishing and image generation
land in later phases.

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
`approvals` table. The dashboard page at `/approval-queue` renders the queue read-only; actions are
performed through the API. Publishing remains a separate, later phase. See
[docs/06-approval-queue.md](docs/06-approval-queue.md) for the lifecycle and examples.

## Documentation

- [Project overview](docs/00-project-overview.md)
- [Database schema](docs/01-database-schema.md)
- [Source registry](docs/02-source-registry.md)
- [Fetching pipeline](docs/03-fetching-pipeline.md)
- [Normalization and scoring](docs/04-normalization-and-scoring.md)
- [Post generation](docs/05-post-generation.md)
- [Approval queue](docs/06-approval-queue.md)
