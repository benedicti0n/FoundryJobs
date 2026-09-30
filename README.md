# FoundryJobs

Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.

FoundryJobs fetches hiring posts from trusted internet sources, filters and scores them with AI,
generates platform-specific posts for Telegram, X, Instagram, and LinkedIn, and keeps them in an
approval queue before anything is published.

**Current phase: Phase 2 — Source Registry.** The monorepo, PostgreSQL schema, and source registry
CRUD are in place. Fetching, AI scoring, post generation, and publishing land in later phases.

## Requirements

- Node.js >= 20.9
- pnpm >= 10
- PostgreSQL 13+ (for `gen_random_uuid()`)

## Structure

- `apps/web` — Next.js dashboard (Tailwind, TypeScript)
- `apps/api` — Fastify API server
- `apps/worker` — background worker placeholder
- `packages/shared` — shared constants, types, DTOs, and validation helpers
- `packages/db` — Drizzle schema, migrations, repositories, and seed scripts
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
```

The API serves `GET /health`, `GET /v1/status`, `GET /v1/db/status`, and the source registry under
`/v1/sources`.

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

Source fetching is **not implemented yet** — the registry only stores where future fetches will run.
See [docs/02-source-registry.md](docs/02-source-registry.md) for types, platforms, and examples.

## Documentation

- [Project overview](docs/00-project-overview.md)
- [Database schema](docs/01-database-schema.md)
- [Source registry](docs/02-source-registry.md)
