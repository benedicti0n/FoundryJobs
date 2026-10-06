# SuperProfile AutoDM — Live MCP Discovery (Stage A)

Read-only discovery of the SuperProfile MCP server for the Instagram AutoDM pipeline. No
automation was created, edited, activated, or deleted during this stage. All findings below come
from live authenticated calls.

## Authentication

- MCP URL: `https://mcp.superprofile.bio/mcp` (OAuth 2.1 Bearer, RFC 9728 protected resource).
- Dynamic client registration: `POST https://mcp.superprofile.bio/register` → public client
  (`token_endpoint_auth_method: "none"`), no client secret. Client id is persisted in the local
  auth store.
- Authorization code + PKCE S256; the `/authorize` endpoint additionally requires the RFC 8707
  `resource` parameter set to `https://mcp.superprofile.bio/mcp` (without it the endpoint returns
  `400 invalid_request: "Use code flow and the advertised resource URL."`).
- Token exchange (`POST /token`, form encoded) also requires `resource`; access tokens expire in
  ~15 minutes (`expires_in: 899`) and refresh tokens are issued (`refresh_token` grant supported).
- Granted scopes: `autodm:read autodm:write autodm:activate accounts:read`. `accounts:read` was
  proven necessary by authenticated discovery: `get_context` returns
  `403 insufficient_scope` without it. `autodm:delete` was not requested.
- Local credential store (outside git, mode 600):
  `~/.config/foundryjobs/superprofile-auth.json` — `{ provider, mcpUrl, clientId, clientSecret,
scope, tokenType, accessToken, refreshToken, expiresAt, obtainedAt }`. Tokens are never printed
  or committed.

## Tool inventory (authenticated `tools/list`, 11 tools)

`get_context`, `list_content`, `list_automations`, `get_automation`, `prepare_automation`,
`save_automation_draft`, `duplicate_automation`, `activate_automation`, `pause_automation`,
`get_operation`, `report_missing_capability`.

AutoDM context tool is **`get_context`** (no arguments). The `autodm:delete` scope would unlock
`delete_automation`; it is intentionally not requested.

### Required scopes per operation

| Operation                                                           | Scopes                            |
| ------------------------------------------------------------------- | --------------------------------- |
| `get_context`                                                       | `accounts:read`                   |
| `list_content`                                                      | `accounts:read`                   |
| `list_automations`, `get_automation`, `prepare_automation`          | `autodm:read`                     |
| `save_automation_draft`, `duplicate_automation`, `pause_automation` | `autodm:write`                    |
| `activate_automation`                                               | `autodm:write`, `autodm:activate` |
| `delete_automation`                                                 | `autodm:delete` (not granted)     |

## Accounts and content

- Connected account: `{ platform: "instagram", accountId: "17841416122040792", username:
"foundryjobss", state: "connected", creditsRequired: false }`.
- `list_content({ accountId, platform: "instagram", kind: "posts"|"stories", limit, cursor })`
  returns `{ items: [{ contentId, kind, caption, mediaType, permalink, previewImageUrl,
publishedAt }], nextCursor, captionsAreUntrusted }`. Only **published** content is returned; no
  scheduled/unpublished targeting is exposed.
- A specific Instagram post is identified by its numeric `contentId` (for example the live
  FoundryJobs post `18098371634551771`, `https://www.instagram.com/p/DeI7AlRjpKr/`), and bound with
  `trigger.target: "specific"` + `contentId`. `target: "next"` also exists but should not be used
  for FoundryJobs (wrong-post risk).

## `prepare_automation` spec (exact shape, abridged)

```jsonc
{
  "platform": "instagram" | "messenger",
  "accountId": "17841416122040792",
  "trigger": { "type": "comment" | "story_reply" | "inbound_dm" | "live_comment" | "shared_post_dm" | "referral_link" | "qr", "target": "specific" | "all" | "next" },
  "contentId": "18098371634551771",              // for target=specific
  "title": "<=120 chars (optional)",
  "keywords": { "mode": "keywords" | "any", "include": ["figma"], "exclude": [] }, // <=50 distinct, <=100 chars each
  "message": { "kind": "text", "text": "<=1000 chars", "buttons": [/* <=3 */] },
  "commentReply": "<=500 chars",                 // or
  "commentReplies": ["<=500", "...", "..."],     // <=3 variants; one is chosen at random per comment
  "followGate": { /* omitted -> dashboard defaults; do not enable aggressively */ },
  "openingMessage": { "text": "<=900", "button": "<=20" }, // REQUIRED for comment triggers with follow-ups
  "primaryDelay": { "timeValue": 1, "timeUnit": "minute" }, // new/changed: 30-1800s or 1-30min
  "followUps": [{ "when": "after_delay", "delay": { "timeValue": 2, "timeUnit": "minute" }, "message": { /* text | image/video/audio/pdf assetId | card */ } }],
  "automationId": "...", "expectedVersion": "..." // only when editing
}
```

- Primary message buttons (max 3, label <=60): URL buttons (`{label, url}`) or `send_dm` buttons
  that reveal a nested message; product buttons exist for owned/published products.
- Follow-up messages support text, verified media assets (`assetId` 64-hex), or cards
  (`imageAssetId` 64-hex); **follow-up buttons support URLs only**.
- Media is referenced by verified asset ids; asset upload happens outside MCP. There is no
  AutoDM-specific asset-upload tool in this connection.

## Delays

- `primaryDelay` bounds for new/changed values: **30–1800 seconds or 1–30 minutes**; default for a
  new automation is 1 minute.
- Follow-up delays use the same `{ timeValue, timeUnit }` shape; a **2-minute follow-up is exactly
  supported** and is already used by the existing automation below.
- Limitation from context: primary delays also delay agent-managed public comment replies, and
  comment/live triggers with follow-ups require an explicit `openingMessage` (recipient consent
  tap) before DMs proceed.

## Replies, buttons, variables, idempotency

- Public comment replies: **maximum 3 variants** (`commentReplies`), one chosen at random per
  comment. FoundryJobs proposed 6 seeds; only 3 can be active per automation.
- Variables: `{{Name}}`, `{{Email}}`, `{{FollowerCount}}` supported in message text/subtitles
  (not in Messenger).
- Idempotency: every write takes `idempotencyKey` matching
  `^[0-9]{13}:[A-Za-z0-9_-]{16,80}$` — `serverTime` (from `get_context`) in ms, a colon, then 16–80
  fresh random characters. Reuse the same key **only** to retry the same call.
- Versioning: `get_automation` returns `version`; `activate_automation`, `duplicate_automation`,
  and edits require `expectedVersion`.
- Lifecycle: `prepare_automation` (validate + preview + `previewToken`) →
  `save_automation_draft` (new automations are saved as non-executable drafts) →
  `activate_automation` (publishes; real messages begin). `pause_automation` stops future matching.
- Errors: envelope includes `retryable`, `requestId`, `requiredScopes`/`missingScopes`,
  `nextAction`. No 429/503/Retry-After semantics are documented in `get_context`; treat
  `retryable: true` with bounded backoff.

## Existing automation discovered (important for idempotency)

`list_automations` shows one **active** automation already on the account (not created by this
repo work):

- `automationId: 6ac4871ae921b400135380e6`, state `active`, `supportedForEditing: true`,
  `contentId: 18098371634551771` (our live Figma Data Engineer Intern post).
- Keyword `figma`; comment reply + 3 reply variants; primary message with `{{Name}}` and an
  "Application Link" button to the Greenhouse URL; `openingMessage` (consent tap); `primaryDelay`
  1 minute; one `after_delay` follow-up of **2 minutes** with a card (`imageAssetId
545433f5e490a3ab348aef47136a91b6d3d17d8952f1918096dd37b3f721f16c`) and a URL button
  `Telegram` → `https://t.me/foundry_jobs`.

FoundryJobs must not create a second automation for the same post without deciding how to handle
this existing one.

## Gaps vs the proposed FoundryJobs flow

- Public reply variants: proposed 6 → SuperProfile maximum is 3.
- "First DM immediately with the link": a comment trigger with follow-ups requires an explicit
  `openingMessage` consent tap before the primary DM; the link arrives after the tap, not purely on
  the comment.
- Second DM with banner media: requires a verified SuperProfile `imageAssetId`. The existing
  automation already references one. The approved banner candidates are now committed under
  `apps/worker/assets/` (`foundryjobs-telegram-banner.png` 1672x941, plus alt-1 1254x1254 and
  alt-2 2172x724); the exact file still needs visual confirmation, and it must be uploaded as a
  verified SuperProfile asset before the follow-up card can use it.
- The Telegram URL `https://t.me/foundry_jobs` was observed in the existing automation; it must be
  confirmed as the official community URL before being configured via `FOUNDRYJOBS_TELEGRAM_URL`
  (left empty in `.env.example`, nothing hardcoded).
- 429/503 behavior is not specified by the live schema; retries must rely on the `retryable` flag
  and idempotency keys.
