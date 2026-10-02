# Real Credential Tests

Phase 16 adds guarded commands that validate the real Telegram, Cloudflare R2, and Buffer
integrations with production code paths. Each command processes exactly one record, refuses to run
without explicit confirmation, and never fakes success.

## Purpose

The publishing and storage integrations were built and tested against configuration-missing paths
only. These commands exist so an operator can prove one real end-to-end call per service before
trusting them in production: one Telegram message, one R2 upload, one Buffer post.

## Safety guard

All three commands refuse to run unless `LIVE_INTEGRATION_TESTS=true` is set:

```text
Live integration tests are disabled. Set LIVE_INTEGRATION_TESTS=true to run this command.
```

They also:

- process at most one record (the first eligible one, or none);
- print the selected `generatedPostId` before any external call;
- use the existing publisher, uploader, and repository code paths rather than ad-hoc clients;
- exit non-zero when confirmation or a required env var is missing, or when no eligible record
  exists;
- never print secret values.

## Commands and required env vars

```bash
# Publish one approved Telegram draft
LIVE_INTEGRATION_TESTS=true pnpm test:telegram-publish
# Requires: DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

# Upload one local Instagram card to R2
LIVE_INTEGRATION_TESTS=true pnpm test:r2-upload
# Requires: DATABASE_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
#           R2_BUCKET_NAME, R2_PUBLIC_BASE_URL

# Publish one approved X draft through Buffer (default platform: x)
LIVE_INTEGRATION_TESTS=true pnpm test:buffer-publish
# Requires: DATABASE_URL, BUFFER_ACCESS_TOKEN, BUFFER_PROFILE_ID_X

# Publish one approved Instagram draft through Buffer instead
LIVE_INTEGRATION_TESTS=true BUFFER_TEST_PLATFORM=instagram pnpm test:buffer-publish
# Requires: DATABASE_URL, BUFFER_ACCESS_TOKEN, BUFFER_PROFILE_ID_INSTAGRAM
```

For the Buffer test, Instagram additionally requires the card's `imageUrl` to be a public
`http(s)` URL (upload it with the R2 test first); local `/generated/...` images are skipped by the
existing pipeline.

## Preparing exactly one draft

1. Open the dashboard at `/approval-queue` and approve exactly one draft for the platform under
   test (Telegram, X, or Instagram), or approve one through the API.
2. Make sure no other approved draft for that platform is waiting, so the "first eligible record"
   is the one you intend.

The commands pick the first eligible row and stop; they never loop.

## Expected database changes

| Test     | On success                                                     | On failure                                   |
| -------- | -------------------------------------------------------------- | -------------------------------------------- |
| Telegram | one `publish_events` row `success`; generated post `published` | `publish_events` row `failed`; post `failed` |
| R2       | `generated_posts.image_url` becomes the R2 public URL          | no database change, exit 1                   |
| Buffer   | one `publish_events` row `success`; generated post `published` | `publish_events` row `failed`; post `failed` |

Verify with SQL or the API:

```sql
select platform, status, external_post_id, published_url, error_message
from publish_events order by created_at desc limit 5;

select id, platform, status, image_url from generated_posts order by updated_at desc limit 5;
```

`GET /v1/publish-events` and the `/publish-events` dashboard page show the same rows.

## Avoiding accidental spam

- Run one command at a time and only when you intend a real external action.
- Keep `LIVE_INTEGRATION_TESTS` unset in shells, CI, and service environments; set it inline for the
  single invocation only.
- Do not leave multiple approved drafts for the same platform when testing, or the first eligible
  one may not be the one you reviewed.
- The scheduler never calls these commands and never publishes.

## Resetting a local scratch database

The live tests mutate the local database. If you want a clean slate afterwards:

```bash
dropdb foundryjobs_dev
createdb foundryjobs_dev
DATABASE_URL="postgres://<user>@127.0.0.1:5432/foundryjobs_dev" pnpm db:migrate
pnpm db:seed:sources
```

The R2 test also leaves one object in the bucket under
`foundryjobs/instagram-cards/instagram-card-<generatedPostId>.png`; delete it manually if it was only
a test.
