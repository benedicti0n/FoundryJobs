# Buffer Publishing

Phase 10 publishes approved X, Instagram, and LinkedIn drafts through Buffer and records every
attempt in the shared `publish_events` table. Telegram keeps using its direct bot pipeline and is
not routed through Buffer.

## Why Buffer is used for X, Instagram, and LinkedIn

Each of those platforms needs its own OAuth application, review process, media rules, and rate
limits. Buffer provides a single publishing API in front of all three, so FoundryJobs can ship one
integration now and keep the platform-specific complexity out of the codebase. The alternative,
direct integrations, would require three separate app registrations and long platform reviews before
anything could be published, and this phase explicitly rules out direct X, Meta, and LinkedIn API
calls.

## Required environment variables

| Variable                      | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `BUFFER_ACCESS_TOKEN`         | Buffer API access token.                     |
| `BUFFER_PROFILE_ID_X`         | Buffer channel id for the X account.         |
| `BUFFER_PROFILE_ID_INSTAGRAM` | Buffer channel id for the Instagram account. |
| `BUFFER_PROFILE_ID_LINKEDIN`  | Buffer channel id for the LinkedIn account.  |

The client never reads them at import time. At call time the token plus the matching
`BUFFER_PROFILE_ID_*` value for the post's platform are required; otherwise the error
`BUFFER_ACCESS_TOKEN and the matching BUFFER_PROFILE_ID_* value are required for Buffer publishing`
is returned with no database changes. The worker is stricter: it exits 1 listing every missing
variable before touching the database.

## Buffer API: GraphQL only

Buffer's legacy REST API no longer accepts public API tokens (`Public API tokens are not accepted
for REST API access`) and is scheduled for retirement on 1 February 2027. The client in
`packages/buffer/src/client.ts` therefore talks to the GraphQL API at `https://api.buffer.com` with
`Authorization: Bearer <BUFFER_ACCESS_TOKEN>` and the `createPost` mutation:

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) { ... }
}
```

with `mode: shareNow`, `schedulingType: automatic`, `needsApproval: false`, `text`, and either an
empty `assets` list (text-only posts for X and LinkedIn) or `assets: [{ image: { url } }]` for
Instagram. The `BUFFER_PROFILE_ID_*` values are Buffer **channel ids**, not legacy profile ids; find
them after connecting a channel with:

```graphql
query {
  channels(input: { organizationId: "<organizationId>" }) {
    id
    name
    service
  }
}
```

Get `organizationId` from `account { organizations { id name } }`. Successful posts return
`PostActionSuccess.post.id` and `PostActionSuccess.post.externalLink`; error union members
(`NotFoundError`, `InvalidInputError`, and so on) surface their message as the sanitized failure
reason.

## Approved-only rule

Only generated posts with status `approved` are published. Drafts, rejected posts, Telegram posts,
and posts that already have a successful publish event are skipped with an explanatory message.

## Instagram requires a public image URL

Instagram posts publish as image posts, so the publisher checks the image before any Buffer call:

- no `imageUrl` → skipped with `Instagram publishing requires a public image URL`;
- a local `/generated/...` URL → skipped with
  `Instagram image URL must be public; upload the card to R2 before publishing`;
- a public `http(s)` URL (for example after `upload-instagram-cards:once`) → published with the
  GraphQL `assets: [{ image: { url } }]` input.

X and LinkedIn publish text-only.

## publish_events audit trail

The same audit table from Phase 7 is reused: successful publishes insert a `success` row with the
GraphQL post id (`external_post_id`) and the post's `externalLink` when Buffer returns one, failed
Buffer calls insert a `failed` row with the sanitized error, and generated posts move to
`published` or `failed` accordingly. Because
`publish_events.platform` is generic, the `/publish-events` page and `GET /v1/publish-events`
already show Telegram and Buffer events together.

## Running Buffer publishing

```bash
# Publish up to 10 approved X/Instagram/LinkedIn drafts
pnpm --filter @foundryjobs/worker publish-buffer:once

# Override the batch size (1-200)
PUBLISH_BUFFER_LIMIT=25 pnpm --filter @foundryjobs/worker publish-buffer:once

# Publish one specific generated post
curl -X POST http://localhost:4000/v1/generated-posts/<id>/publish/buffer
```

The worker exits 1 when `DATABASE_URL` or Buffer variables are missing (before modifying the
database), exits 0 when the run completes even if individual posts fail, and prints one line per
post with the status, platform, external id, URL, or error.

API behaviors, documented for consistency:

- invalid UUID returns **400**;
- missing generated post returns **404** `Generated post not found`;
- Telegram posts return a **200 skipped** result (`Telegram publishing is handled by the Telegram
pipeline, not Buffer`);
- non-approved posts and Instagram posts without a public image return **200 skipped** results;
- a publishable post with missing Buffer configuration returns **500** with the configuration
  message and no database changes;
- a Buffer API failure returns **200** with `status: "failed"` after the failure is recorded.

## Non-goals for this phase

- No direct X API, no direct Meta/Instagram API, and no direct LinkedIn API.
- No scheduling or cron; publishing runs manually.
- No authentication yet, so the publish endpoints should not be exposed publicly.
- No AI image generation; Instagram cards come from the Phase 8 renderer and Phase 9 R2 upload.
