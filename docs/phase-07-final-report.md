# Phase 7 — Telegram Publishing: Final Report

## Files created/changed (full paths)

**Commit 1 — shared**

- Created: `packages/shared/src/publishing.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — telegram**

- Created: `packages/telegram/package.json`
- Created: `packages/telegram/tsconfig.json`
- Created: `packages/telegram/src/client.ts`
- Created: `packages/telegram/src/publish.ts`
- Created: `packages/telegram/src/index.ts`
- Modified: `pnpm-lock.yaml`

**Commit 3 — db**

- Created: `packages/db/src/repositories/publish-events.ts`
- Modified: `packages/db/src/index.ts`

**Commit 4 — publisher**

- Created: `packages/publisher/package.json`
- Created: `packages/publisher/tsconfig.json`
- Created: `packages/publisher/src/publish-telegram-one.ts`
- Created: `packages/publisher/src/publish-telegram-run.ts`
- Created: `packages/publisher/src/index.ts`
- Modified: `pnpm-lock.yaml`

**Commit 5 — worker**

- Modified: `apps/worker/src/index.ts`
- Modified: `apps/worker/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 6 — api**

- Created: `apps/api/src/routes/publish-events.ts`
- Modified: `apps/api/src/index.ts`
- Modified: `apps/api/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 7 — web**

- Created: `apps/web/src/app/publish-events/page.tsx`
- Modified: `apps/web/src/app/page.tsx`

**Commit 8 — docs**

- Created: `docs/07-telegram-publishing.md`
- Modified: `README.md`

## Commands run

`pnpm install` (after each new package), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `node apps/api/dist/index.js` runtime smoke tests (without `DATABASE_URL`, and with `DATABASE_URL` but without Telegram env), `node apps/worker/dist/index.js` boot smoke test, `pnpm --filter @foundryjobs/worker publish-telegram:once` (without `DATABASE_URL`, and with `DATABASE_URL` but without Telegram env), `curl` against `/health`, `/v1/publish-events`, the publish endpoint, and Phase 0–6 regression endpoints, `next start` render tests for `/publish-events` and `/` with and without `API_BASE_URL`, `psql` state verification against `foundryjobs_dev`, and temporary smoke scripts inside `packages/telegram`, `packages/db`, and `packages/publisher` (deleted, never committed).

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all twelve workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `telegram`, `publisher`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## API smoke test results

Without `DATABASE_URL` (and without Telegram env): `GET /health` returns `{"ok":true,"service":"foundryjobs-api"}`; `GET /v1/publish-events` returns HTTP 500 `{"error":{"message":"DATABASE_URL is required for publish repository operations"}}`; `GET /v1/publish-events?platform=bad` returns HTTP 400 `platform must be one of: telegram, x, instagram, linkedin`; `GET /v1/publish-events?status=bad` returns HTTP 400 `status must be one of: pending, success, failed`; `POST /v1/generated-posts/00000000-0000-4000-8000-000000000000/publish/telegram` returns HTTP 500 with the clear repository message; a non-UUID id returns HTTP 400 `id must be a valid UUID`; graceful shutdown is logged.

With `DATABASE_URL` but without Telegram env: `GET /v1/publish-events` returns HTTP 200 with an empty list; the publish endpoint on the approved Telegram post returns HTTP 500 `{"error":{"message":"TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing"}}`; a missing generated post returns HTTP 404 `Generated post not found`; the Phase 6 regression endpoint `GET /v1/approval-queue` still returns HTTP 200; the database was verified unchanged afterwards.

## Worker publish-telegram:once test result

Without `DATABASE_URL` it prints `DATABASE_URL is required to run publish-telegram:once. Set it in the environment or the root .env file.` and exits 1. With `DATABASE_URL` but without Telegram env it prints `TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required to run publish-telegram:once. No posts were published.` and exits 1 before touching the database. The default worker mode still logs `FoundryJobs worker booted` and `No scheduled jobs registered yet`, and `fetch:once`, `normalize:once`, and `generate-posts:once` remain available and unchanged.

## Telegram credential availability

No. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are both unset and there is no root `.env` file, so no publish path could be executed against the real Telegram API.

## Whether an actual Telegram message was sent

No actual Telegram message was sent. Per the phase instructions, only the config-missing behavior was tested, and no success was faked. The success and failure recording paths were validated against disposable synthetic generated posts in the scratch database: `recordPublishSuccess` inserted a success event and marked its post `published`, `recordPublishFailure` inserted a failed event and marked its post `failed`, `hasSuccessfulPublishEvent` flipped from false to true, the ready list stopped returning the published post, and all three synthetic events plus both synthetic posts were deleted afterwards, restoring the database to zero events and twelve posts.

## Approved Telegram drafts before publishing

There were 0 approved Telegram drafts at the start of the phase, because the two Phase 6 approvals were on X and Instagram drafts. As instructed by the test plan, one Telegram draft was approved through the approval repository during test setup (`decidedBy: "phase7-test"`), so there was 1 approved Telegram draft when the publishing tests ran; it remains approved because no Telegram attempt was possible.

## publish_events inserted

Zero publish_events exist in the database after all live testing. Three synthetic events (one `success`, one `failed`, one `pending`) were created on disposable rows during the repository test and then deleted in the same script, and the config-missing paths never insert events.

## generated_posts marked published or failed

Zero real generated posts changed publishing status: no post is `published` and no post is `failed` in the database. During the disposable repository test, one synthetic post was marked `published` and one `failed`, and both rows were deleted during cleanup.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–7 state: 61 raw posts, 22 job posts, 22 scores, 12 generated posts (8 draft, 1 approved Telegram, 1 approved X, 1 approved Instagram, 1 rejected Instagram, 1 rejected X), 7 approval rows, and 0 publish events. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## Commit hashes and messages

| Hash      | Message                                         |
| --------- | ----------------------------------------------- |
| `0f4744a` | feat(shared): add publishing types              |
| `3a1c1fb` | feat(telegram): add Telegram publishing client  |
| `a12759e` | feat(db): add publish repositories              |
| `eccd7e2` | feat(publisher): add Telegram publish pipeline  |
| `76ae362` | feat(worker): add Telegram publish once command |
| `82f891a` | feat(api): add Telegram publish endpoints       |
| `fb24f97` | feat(web): add publish events page              |
| `f9236aa` | docs: document Telegram publishing              |

## Known issues

1. Actual Telegram delivery was never exercised because no bot token or chat id was available, so the real send path remains untested against the Telegram API.
2. There is no unique constraint or lock guarding `generated_post_id` plus `status = "success"` in publish_events, so two concurrent publish runs could both send the same approved post before either records a success event.
3. The API publish endpoint returns HTTP 500 when the Telegram variables are missing even though the request itself is valid, which is per the phase spec but makes a configuration problem look like a client-triggered server error.
4. Failed Telegram sends set the generated post to `failed`, and because the worker only selects `approved` posts, failed posts are never retried automatically and require re-approval or a manual status change.
5. The Telegram client does not distinguish permanent API errors such as a wrong chat id from transient ones such as network timeouts, so all failures are recorded identically.
6. `published_url` is null for chats without a public username, so those successful sends can only be identified by their numeric message id.
7. Telegram 429 rate limits and retry backoff are not handled, and every non-ok response becomes a single failed attempt.
8. The publish endpoints are unauthenticated, so anyone with network access to the API can send real Telegram messages for approved drafts.

## Next recommendations

- Provide `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, then run a single real publish end to end to validate the send path, message formatting in the target chat, and `published_url` generation.
- Add a database-level idempotency guard (unique partial index or advisory lock) around successful publish events to make concurrent publishing race-free.
- Classify Telegram errors into permanent and transient, add retry with backoff for 429 and network failures, and only mark a post `failed` for permanent errors.
- Add authentication or network isolation before exposing any publish endpoint beyond localhost.
- Proceed to the next platform integration (X next) or scheduling, reusing the `publish_events` audit trail and approved-only rule.
