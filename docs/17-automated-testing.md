# Automated Testing

This document describes the automated regression suite that protects the production-critical
FoundryJobs behavior validated manually in Phases 5 and 6.

## Test runner

The suite uses **`node:test`** (Node's built-in test runner) executed through **tsx**, which is
already used across the workspace for TypeScript execution.

Why this combination:

- no new test framework or runner dependency is introduced; `node:test` ships with Node 25 and
  returns a non-zero exit code on failure by default;
- `tsx` resolves TypeScript and the `@foundryjobs/*` workspace packages exactly like the worker and
  API do at development time;
- tests are plain ESM TypeScript files with `node:assert/strict`, so there is no framework-specific
  API to learn or maintain.

Run everything with:

```bash
pnpm test        # recreates + migrates the test DB, then runs all tests
pnpm test:unit   # runs the tests only (assumes the test DB is already migrated)
```

`pnpm test` is non-interactive, safe in CI, requires no secrets, and makes no network calls.

## Directory and file conventions

```
tests/
  helpers/            shared test utilities
    async.ts          delay/waitFor helpers
    test-db.ts        env guard, fixtures, cleanup, closeTestDatabase
  worker/             scheduler behavior
  approvals/          approval transitions and queue semantics
  publishers/         publish eligibility, routing, duplicate and failure guards
  api/                API authorization via Fastify inject
  web/                admin session/auth primitives
```

- One file per behavior area, named `<topic>.test.ts`.
- Tests never import each other; shared setup lives in `tests/helpers/`.
- Node's test runner is invoked with `--test-concurrency=1`, so files run one at a time against the
  shared test database.

## Database requirements

Tests that touch the database use a dedicated local database, `foundryjobs_test`, which is dropped
and recreated on every `pnpm test` run:

- default URL: `postgres://benediction@127.0.0.1:5432/foundryjobs_test`
- override with `TEST_DATABASE_URL` if your local server differs.
- `packages/db/scripts/setup-test-db.ts` refuses to run against any non-local host or any database
  name that does not end in `_test`, so the suite can never touch Neon or the scratch
  `foundryjobs_dev` database.
- `tests/helpers/test-db.ts` applies the same guard before any test code can open a connection and
  forces `process.env.DATABASE_URL` to the test URL.
- Fixtures created by tests are tracked and deleted in `closeTestDatabase()` via `after()` hooks;
  the runner also starts from a freshly migrated database every time, so no manual cleanup is
  needed.

The scheduler and admin-session tests do not use the database at all.

## How external providers are mocked

The suite never calls Telegram, Buffer, R2, Gemini, or ATS APIs. External boundaries are injected
through small, behavior-preserving seams:

- **Scheduler**: `WorkerScheduler` accepts a third constructor argument, a `ScheduledJobRunner`.
  Production constructs it without the argument and gets the real `runScheduledJob`; tests pass
  fake runners and control timing precisely.
- **Telegram publisher**: `publishTelegramGeneratedPost(id, { provider })` accepts a fake provider
  returning `TelegramPublishOutcome` or throwing.
- **Buffer publisher**: `publishBufferGeneratedPost(id, { publishText, publishImage })` accepts fake
  provider functions.
- **API**: `createApp()` (extracted from `apps/api/src/index.ts`) lets tests use Fastify's
  `app.inject()` with no listening socket and no real traffic.
- **Admin session/auth**: session primitives live in `apps/web/src/lib/admin-session.ts`, a pure
  module with no Next.js request context, so signing/verification can be tested directly.

Tests set only test-only environment values (for example `API_ADMIN_TOKEN`, `TELEGRAM_*`,
`BUFFER_*`), never real credentials, and provider invocation counts are asserted so a regression
that reaches a real provider fails loudly instead of making a network call.

## Coverage map

| File                                      | Protects                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/worker/scheduler-startup.test.ts`  | Sequential pipeline order on `SCHEDULER_RUN_ON_START` (bug fixed in `74d6fe9`), one job at a time, failures surfaced and non-fatal, publishing absent from the registry         |
| `tests/worker/scheduler-overlap.test.ts`  | Per-job overlap guard skips ticks instead of running concurrently; intervals stay independent; `stop()` clears timers                                                           |
| `tests/approvals/transitions.test.ts`     | draft→approved/rejected/needs_edit, failed→approved retry, exact edit persistence, empty-edit rejection, approval audit rows                                                    |
| `tests/approvals/queue-semantics.test.ts` | Queue is `generated_posts.status='draft'` and intentionally not equal to `approvals` row counts                                                                                 |
| `tests/publishers/telegram.test.ts`       | Status eligibility, single provider invocation, success metadata, event-based replay guard, failure/retry                                                                       |
| `tests/publishers/buffer.test.ts`         | X routing through the text provider, Telegram fall-through prevention, Instagram/LinkedIn fail-closed when unconfigured, Instagram image URL rules, replay guard, failure/retry |
| `tests/api/admin-token.test.ts`           | 401 without/with wrong token, token accepted, read-only endpoints public, publish endpoints authorize before provider work                                                      |
| `tests/web/admin-session.test.ts`         | Credential verification, signed session round-trip, forged/tampered/expired/rotated-secret sessions rejected                                                                    |

## Intentionally not covered

- Next.js cookie set/clear behavior (`createAdminSession`/`destroyAdminSession`) and the real
  server-action HTTP round trip; those need a running Next server and were validated manually in
  the Phase 6 report. The signing/verification primitives they rely on are covered.
- The server-action page/auth flow; middleware behavior is exercised manually.
- Live provider contract tests. These remain opt-in and guarded by `LIVE_INTEGRATION_TESTS=true`
  (see `docs/16-real-credential-tests.md`) and must never run in the automated suite.
- Rendering/visual output of Instagram cards and R2 uploads (no external calls allowed).
- Database migration drift; migrations run against the empty test database on every `pnpm test`.

## Adding new regression tests

1. Pick the closest folder or create a new one under `tests/`.
2. If the test needs the database, import `tests/helpers/test-db.ts` before other imports (it sets
   the guarded `DATABASE_URL`), create fixtures with `createFixtureJob`/`createFixturePost`, and
   register `after(async () => closeTestDatabase())`.
3. If the test touches an external provider, add a default-argument seam on the function under test
   (like the existing publisher deps) instead of mocking modules.
4. Never load the root `.env` in tests and never reference real credentials.
5. Run `pnpm test`, then `pnpm exec prettier --check .` and `pnpm lint` before committing.
