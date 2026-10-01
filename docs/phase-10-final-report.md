# Phase 10 — Buffer Publishing for X, Instagram, and LinkedIn: Final Report

## Files created/changed (full paths)

**Commit 1 — shared**

- Created: `packages/shared/src/buffer.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — buffer**

- Created: `packages/buffer/package.json`
- Created: `packages/buffer/tsconfig.json`
- Created: `packages/buffer/src/client.ts`
- Created: `packages/buffer/src/profile-config.ts`
- Created: `packages/buffer/src/publish.ts`
- Created: `packages/buffer/src/index.ts`
- Modified: `.env.example`
- Modified: `pnpm-lock.yaml`

**Commit 3 — db**

- Created: `packages/db/src/repositories/buffer-publish.ts`
- Modified: `packages/db/src/index.ts`

**Commit 4 — buffer-publisher**

- Created: `packages/buffer-publisher/package.json`
- Created: `packages/buffer-publisher/tsconfig.json`
- Created: `packages/buffer-publisher/src/publish-buffer-one.ts`
- Created: `packages/buffer-publisher/src/publish-buffer-run.ts`
- Created: `packages/buffer-publisher/src/index.ts`
- Modified: `pnpm-lock.yaml`

**Commit 5 — worker**

- Modified: `apps/worker/src/index.ts`
- Modified: `apps/worker/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 6 — api**

- Modified: `apps/api/src/routes/publish-events.ts`
- Modified: `apps/api/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 7 — web**

- Modified: `apps/web/src/app/generated-posts/page.tsx`
- Modified: `apps/web/src/app/publish-events/page.tsx`

**Commit 8 — docs**

- Created: `docs/10-buffer-publishing.md`
- Modified: `README.md`

## Commands run

`pnpm install` (after each dependency change), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `pnpm --filter @foundryjobs/worker publish-buffer:once` (without `DATABASE_URL`, and with `DATABASE_URL` but no Buffer env), `node apps/worker/dist/index.js publish-buffer:once` (built bundle config-missing check), `node apps/worker/dist/index.js` default boot regression, `pnpm --filter @foundryjobs/worker publish-telegram:once` regression, `node apps/api/dist/index.js` runtime smoke tests (without `DATABASE_URL`, and with `DATABASE_URL` but no Buffer env), `curl` against the new Buffer publish endpoint and the Phase 6–9 regression endpoints, `next start` render tests for `/generated-posts` and `/publish-events`, `psql` state verification against `foundryjobs_dev`, and temporary smoke scripts inside `packages/buffer`, `packages/db`, and `packages/buffer-publisher` (deleted, never committed).

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all seventeen workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `telegram`, `publisher`, `card-renderer`, `storage`, `card-uploader`, `buffer`, `buffer-publisher`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## API smoke test results

Without `DATABASE_URL`: `GET /health` returns `{"ok":true,"service":"foundryjobs-api"}`; `POST /v1/generated-posts/00000000-0000-4000-8000-000000000000/publish/buffer` returns HTTP 500 `{"error":{"message":"DATABASE_URL is required for Buffer publish repository operations"}}`; a non-UUID id returns HTTP 400 `id must be a valid UUID`; graceful shutdown is logged.

With `DATABASE_URL` but no Buffer env: publishing the approved X post returns HTTP 500 `{"error":{"message":"BUFFER_ACCESS_TOKEN and the matching BUFFER_PROFILE_ID_* value are required for Buffer publishing"}}`; the approved Telegram post returns a 200 skipped result with `Telegram publishing is handled by the Telegram pipeline, not Buffer`; the approved Instagram post with a local image returns a 200 skipped result with `Instagram image URL must be public; upload the card to R2 before publishing`; a draft X post returns a 200 skipped result with `Generated post status is draft; only approved drafts are published`; a missing post returns HTTP 404 `Generated post not found`. Regressions `GET /v1/approval-queue`, `GET /v1/publish-events`, and `GET /v1/generated-posts` all still return HTTP 200.

## Worker publish-buffer:once test result

Without `DATABASE_URL` it prints `DATABASE_URL is required to run publish-buffer:once. Set it in the environment or the root .env file.` and exits 1. With `DATABASE_URL` but no Buffer env it prints `BUFFER_ACCESS_TOKEN and the matching BUFFER_PROFILE_ID_* value are required to run publish-buffer:once. Missing: BUFFER_ACCESS_TOKEN, BUFFER_PROFILE_ID_X, BUFFER_PROFILE_ID_INSTAGRAM, BUFFER_PROFILE_ID_LINKEDIN. No posts were published.` and exits 1 before touching the database, verified through both the tsx script path and the built bundle. The default worker boot and `publish-telegram:once` still behave as before.

## Buffer credential availability

No. `BUFFER_ACCESS_TOKEN`, `BUFFER_PROFILE_ID_X`, `BUFFER_PROFILE_ID_INSTAGRAM`, and `BUFFER_PROFILE_ID_LINKEDIN` are all unset and there is no root `.env` file, so no live Buffer call could be made.

## Whether an actual Buffer publish happened

No actual Buffer publish happened, and no success was faked. Per the phase instructions, only config-missing behavior was tested: the client is import-safe, `isBufferConfigured()` is false, the missing-variable list is reported, `getBufferProfileId`, `publishTextToBuffer`, and `publishImagePostToBuffer` throw the exact required message, the publisher returns `failed` with that message without inserting a publish event or changing a generated post, and the run function fails fast before listing anything. The `publish_events` table remained at zero rows and all three approved posts stayed `approved`.

## Approved Buffer-supported drafts before publishing

There were 2 approved Buffer-supported drafts before publishing: the X draft `Software Engineer, Consumer Revenue` (text-only, 237 characters) and the Instagram draft `Software Engineer, Safety Processing` (still carrying the local `/generated/instagram-cards/instagram-card-58f4fc2d-08a5-4497-9d87-55defddc22df.png` path). The third approved post is Telegram, which Buffer intentionally never handles.

## publish_events inserted

Zero `publish_events` rows were inserted. The table still contains 0 rows because every Buffer path was blocked by missing configuration before any send attempt, and the publisher is explicitly designed to skip event writes for configuration errors.

## generated_posts marked published or failed

Zero generated posts changed publishing status: the final database state is 3 approved, 0 failed, and 0 published. The temporary publisher smoke test additionally confirmed the X post was still `approved` immediately after the attempted publish.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–10 state: 61 raw posts, 22 job posts, 22 scores, 12 generated posts (2 Instagram cards with local image paths), 7 approval rows, and 0 publish events. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## Commit hashes and messages

| Hash      | Message                                             |
| --------- | --------------------------------------------------- |
| `00f84fa` | feat(shared): add Buffer publishing types           |
| `7767303` | feat(buffer): add Buffer publishing client          |
| `baebfe5` | feat(db): add Buffer publish repositories           |
| `2506a09` | feat(buffer-publisher): add Buffer publish pipeline |
| `d5b3f64` | feat(worker): add Buffer publish once command       |
| `52fbd57` | feat(api): add Buffer publish endpoint              |
| `dcf845a` | feat(web): improve publish and generated post pages |
| `676b2af` | docs: document Buffer publishing                    |

## Known issues

1. No actual Buffer publish happened because none of the Buffer variables were available, so the `updates/create.json` request format, the response parsing, and the `service_link` extraction remain untested against the real API.
2. The Buffer integration targets the classic `updates/create.json` REST endpoint, and if Buffer makes its newer GraphQL API the only supported surface this client would need a rewrite.
3. `BufferPublishResult.platform` was widened to `GeneratedPostPlatform | null` (instead of a strict Buffer platform union) so Telegram skips and missing posts can be represented, which deviates slightly from the phase's type sketch.
4. The publisher cannot distinguish permanent from transient Buffer failures, so every Buffer API error records a failed event and marks the generated post `failed`.
5. Instagram publishing depends on the card already being public in R2, and a local `/generated/...` image is only skipped with a message, so the full Instagram publish flow cannot complete until R2 credentials exist.
6. Buffer `service_link` is only present in some responses, so `publishedUrl` can be null even for successful publishes.
7. The worker's strict check refuses to run when any of the four Buffer variables is missing, so a partial configuration such as X-only can publish through the API but not through `publish-buffer:once`.
8. The publish endpoints remain unauthenticated, so anyone with network access to a server holding valid Buffer credentials could trigger real posts.

## Next recommendations

- Configure real Buffer credentials and publish a single X test post end to end, then verify the `publish_events` row, `service_link`, and the `published` status transition.
- Proceed to the next phase: scheduling/cron, authentication, or dashboard approval actions, all of which are still open.
- Add transient-versus-permanent error classification with retry and backoff for Buffer calls.
- Migrate to Buffer's newer API if the classic endpoint is deprecated.
- Consider reconciling Buffer-scheduled updates through its API so `publish_events` stays accurate for anything Buffer retries or delays.
