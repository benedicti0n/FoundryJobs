# Production Deployment

Phase 15 prepares FoundryJobs for production deployment: start scripts, an environment check
command, a readiness endpoint, and this operational guide. No product features were added.

## Recommended service layout

Run the monorepo as three long-lived services plus one worker command runner:

| Service          | Process                                        | Notes                                                        |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Web              | `pnpm start:web` (Next.js production server)   | Dashboard and login; needs `API_BASE_URL`, admin auth vars.  |
| API              | `pnpm start:api` (Fastify from `dist`)         | REST endpoints; needs `DATABASE_URL` and `API_ADMIN_TOKEN`.  |
| Worker scheduler | `pnpm start:scheduler` (worker scheduler mode) | Exactly one instance; runs safe non-publishing jobs.         |
| One-off commands | `pnpm --filter @foundryjobs/worker <command>`  | Fetches, normalizes, generates, renders, uploads, publishes. |

`pnpm start:worker` starts the default worker placeholder mode, which is useful for verifying the
image but does no work; production uses the scheduler or explicit one-off commands.

## Required environment variables

Base app (the `check:env` command fails without these):

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `API_ADMIN_TOKEN`
- `APP_BASE_URL`

Optional, grouped by capability:

- AI extraction: `GEMINI_API_KEY`, `GEMINI_MODEL` (rules fallback works without them).
- Telegram publishing: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Buffer publishing: `BUFFER_ACCESS_TOKEN`, `BUFFER_PROFILE_ID_X`,
  `BUFFER_PROFILE_ID_INSTAGRAM`, `BUFFER_PROFILE_ID_LINKEDIN`.
- R2 storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_BASE_URL`.

The web service additionally needs `API_BASE_URL` pointing at the API service, and the same
`API_ADMIN_TOKEN` so its server actions can call protected mutations.

Run the check after configuring a host (it prints present/missing status only, never values):

```bash
pnpm check:env
```

## Database: Neon and migrations

`DATABASE_URL` should point at a production Postgres (Neon works out of the box; use the pooled
connection string for the running services and the direct connection for migrations).

```bash
# apply all Drizzle migrations
pnpm db:migrate

# generate a new migration after schema changes (development only)
pnpm db:generate

# insert the starter source registry (idempotent)
pnpm db:seed:sources
```

Run migrations as a release step before starting new versions of the API or worker. Do not run
`db:generate` in production.

## Starting each process

```bash
pnpm build          # build web, api, and worker
pnpm check:env      # verify base configuration
pnpm db:migrate     # apply migrations
pnpm start:api      # API service
pnpm start:web      # dashboard
pnpm start:scheduler  # worker scheduler (one instance only)
```

Health and readiness:

- `GET /health` — liveness, always public.
- `GET /ready` — readiness; returns `{ ok, databaseConfigured, adminTokenConfigured }` and is false
  while `DATABASE_URL` or `API_ADMIN_TOKEN` is missing.
- `GET /v1/status`, `GET /v1/db/status` — informational.

## Scheduler warnings

- Run exactly one scheduler instance per environment; there is no distributed lock, and two
  schedulers would duplicate fetch, render, and upload work.
- The scheduler never publishes. Publishing commands (`publish-telegram:once`,
  `publish-buffer:once`, and the publish endpoints) stay manual by design.
- The upload job is skipped with a clear message when R2 is not configured; the rest of the
  scheduler keeps running.

## Security notes

- **HTTPS is required for the admin cookie.** The session cookie is `Secure` in production builds,
  so a plain `http://` deployment will not receive it. Terminate TLS at the platform or proxy.
- **Do not expose API mutation endpoints without `API_ADMIN_TOKEN`.** With the token unset, every
  mutation returns a 500 setup error; with it set, missing or wrong `X-Admin-Token` returns 401.
  Read-only data endpoints are public in this phase, so keep the API on a trusted network or add
  network-level protection if that data is sensitive.
- **Publishing credentials are powerful.** Anyone holding `TELEGRAM_BOT_TOKEN`/`BUFFER_ACCESS_TOKEN`
  plus dashboard access can post publicly; treat them as production secrets and rotate on
  suspicion.

## Instagram cards: local files vs R2

Rendered cards are written to `apps/web/public/generated/instagram-cards/` on the machine that
renders them. That only works when the web service and renderer share a filesystem. In a
multi-service deployment, configure R2 variables and run `upload-instagram-cards:once` so buffers
publish from the public R2 URL; the Buffer pipeline refuses local `/generated/...` image URLs.

## Deployment checklist

1. Provision Postgres (for example Neon) and set `DATABASE_URL`.
2. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `API_ADMIN_TOKEN` (long,
   random values).
3. Set `APP_BASE_URL` and the web service's `API_BASE_URL`.
4. Run `pnpm install --frozen-lockfile` and `pnpm build`.
5. Run `pnpm check:env` and fix every missing required variable.
6. Run `pnpm db:migrate`, then `pnpm db:seed:sources` if the registry is empty.
7. Start the API, web, and exactly one scheduler service over HTTPS.
8. Verify `GET /ready` reports `ok: true`.
9. Configure publishing and R2 variables only when those features should go live.
10. Keep publishing manual: approve on the dashboard, then publish from `/generated-posts` or the
    worker commands.
