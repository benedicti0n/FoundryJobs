# FoundryJobs

Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.

FoundryJobs fetches hiring posts from trusted internet sources, filters and scores them with AI,
generates platform-specific posts for Telegram, X, Instagram, and LinkedIn, and keeps them in an
approval queue before anything is published.

**Current phase: Phase 0 — Bootstrap.** The repository currently contains the monorepo foundation:
app shells, health endpoints, shared config, and documentation. Job fetching, AI scoring, post
generation, and the database schema land in later phases.

## Requirements

- Node.js >= 20.9
- pnpm >= 10

## Structure

- `apps/web` — Next.js dashboard (Tailwind, TypeScript)
- `apps/api` — Fastify API server
- `apps/worker` — background worker placeholder
- `packages/shared` — shared constants, types, and environment helpers
- `packages/db` — Drizzle-ready database package (placeholder, no schema yet)
- `docs/` — project documentation

## Getting started

```bash
pnpm install
cp .env.example .env
```

## Running apps

```bash
pnpm dev:web     # http://localhost:3000
pnpm dev:api     # http://localhost:4000 (GET /health, GET /v1/status)
pnpm dev:worker  # boots the worker placeholder
pnpm dev         # all three in parallel
```

## Workspace scripts

```bash
pnpm build      # build all apps
pnpm typecheck  # TypeScript checks across the workspace
pnpm lint       # ESLint across the workspace
pnpm format     # Prettier write
```

## Documentation

- [Project overview](docs/00-project-overview.md)
