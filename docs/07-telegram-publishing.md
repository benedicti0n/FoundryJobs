# Telegram Publishing

Phase 7 publishes approved Telegram drafts through the Telegram Bot API and records every attempt in
`publish_events`. X, Instagram, and LinkedIn publishing are intentionally not implemented yet.

## Required environment variables

| Variable             | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather).                 |
| `TELEGRAM_CHAT_ID`   | Target chat or channel id, for example `@mychannel` or a numeric id. |

Both are read at publish time, never at import time, so the API and worker start without them. If
either is missing when a publish is attempted, no Telegram request is made, no `publish_events` row
is written, and no generated post status changes; the error message is
`TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing`.

## Publishing flow

1. The worker selects `generated_posts` rows with `platform = "telegram"`, `status = "approved"`,
   and no successful `publish_events` row.
2. For each post, the draft text is sent with Telegram's `sendMessage` endpoint as plain text with
   no `parse_mode`, so emoji, bullets, and other characters pass through unmodified and no HTML
   escaping can break the message. The message content is never altered beyond what Telegram
   accepts.
3. On success, a single database transaction inserts a `publish_events` row with
   `status = "success"`, `external_post_id` set to the Telegram message id, `published_url` set to
   `https://t.me/<chat_username>/<message_id>` when the chat exposes a public username, and
   `published_at` set to now, then marks the generated post `published`.
4. On a Telegram API error or timeout, a single transaction inserts a `publish_events` row with
   `status = "failed"` and the Telegram description, then marks the generated post `failed`.
5. Requests time out after 20 seconds.

Posts that are missing, not Telegram, not approved, or already successfully published are skipped
with an explanatory message instead of being sent.

## Approved-only rule

Nothing is sent to Telegram unless it first passed through the approval queue and its generated post
status is `approved`. The manual API endpoint also refuses non-approved posts by returning a skipped
result, and it verifies the post exists before doing anything else.

## publish_events audit trail

Every attempt produces exactly one `publish_events` row:

- `job_post_id` and `generated_post_id` link the attempt to its content;
- `platform` is `telegram` in this phase;
- `external_post_id` and `published_url` identify the Telegram message on success;
- `status` is `pending`, `success`, or `failed`;
- `error_message` carries the Telegram error description on failure;
- `published_at` is set only for successful sends, while `created_at` records when the attempt was
  made.

`GET /v1/publish-events` lists the trail with `platform`, `status`, `generatedPostId`, `jobPostId`,
`limit`, and `offset` filters.

## Idempotency

- The worker only selects approved Telegram posts that have no successful publish event, so a second
  run right after a successful run processes nothing.
- The single-post publisher checks for an existing successful event before sending and returns
  `skipped` when one exists.
- Failed posts are not selected automatically because the selector only takes `approved` posts, so
  retrying a failed publish requires deciding again (for example by re-approving the draft or by
  re-running the single-post endpoint after clearing its state).

## Why X, Instagram, and LinkedIn are not included yet

Each of those platforms needs OAuth application review, media and thread rules, and per-platform
rate limits, while Telegram is a single-token JSON API and the cleanest first publishing target.
The publisher is split per platform so the same `publish_events` and idempotency guarantees can be
reused when those integrations are added. No Buffer, Meta, X, or LinkedIn API is called anywhere in
the codebase.

## Running publishing

```bash
# Publish up to 10 approved Telegram drafts, one by one
pnpm --filter @foundryjobs/worker publish-telegram:once

# Override the batch size (1-200)
PUBLISH_TELEGRAM_LIMIT=25 pnpm --filter @foundryjobs/worker publish-telegram:once

# Publish one specific generated post (requires Telegram env)
curl -X POST http://localhost:4000/v1/generated-posts/<id>/publish/telegram
```

The worker exits 1 before touching the database when `DATABASE_URL` or the Telegram variables are
missing, exits 0 when the run completes even if individual sends fail, and prints a per-post result
with the external id or the Telegram error.

## Safety note

The publish endpoints have no authentication yet. Do not expose them on a public interface; run the
API on localhost or behind an authenticated proxy until Phase 8 or later adds access control.

## Non-goals for this phase

- No X, Instagram, or LinkedIn publishing.
- No image generation or media uploads.
- No scheduling or cron; publishing runs manually.
- No authentication.
