# Dashboard Publish Buttons

Phase 13 adds manual publish controls to the `/generated-posts` dashboard page so an approved draft
can be published without curl. Publishing stays manual: nothing here runs on a schedule and the
scheduler never calls a publishing endpoint.

## Manual publish flow

1. A reviewer approves a draft on the `/approval-queue` page (or through the approval API).
2. The `/generated-posts` page shows a publish button for every `approved` generated post, as long
   as the platform requirements are met.
3. Clicking the button submits a Next.js server action that calls the FoundryJobs API exactly like
   the manual API workflow: `POST /v1/generated-posts/:id/publish/telegram` for Telegram and
   `POST /v1/generated-posts/:id/publish/buffer` for X, Instagram, and LinkedIn.
4. The action redirects back to `/generated-posts` with a green success notice or an amber error
   notice, and the list re-renders with the updated status.

Drafts, rejected posts, failed posts, and published posts never show an active publish button.
Published posts instead link to `/publish-events`.

## Telegram vs Buffer path

| Platform  | Button                                                       | API endpoint                                    |
| --------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Telegram  | `Publish to Telegram`                                        | `POST /v1/generated-posts/:id/publish/telegram` |
| X         | `Publish to X via Buffer`                                    | `POST /v1/generated-posts/:id/publish/buffer`   |
| LinkedIn  | `Publish to LinkedIn via Buffer`                             | `POST /v1/generated-posts/:id/publish/buffer`   |
| Instagram | `Publish to Instagram via Buffer` (only with a public image) | `POST /v1/generated-posts/:id/publish/buffer`   |

Telegram keeps using the direct bot pipeline from Phase 7. X, Instagram, and LinkedIn go through
Buffer from Phase 10. The dashboard adds no new API endpoints and does not weaken any validation.

## Instagram public image requirement

Instagram publishing requires a publicly reachable image. The dashboard enforces this before
offering the button:

- `imageUrl` starting with `http://` or `https://` (for example after `upload-instagram-cards:once`
  uploaded the card to R2) shows the `Publish to Instagram via Buffer` button;
- `imageUrl` starting with `/generated/` shows the warning `Upload to R2 before publishing.` and no
  button;
- a missing `imageUrl` shows `Instagram publishing requires a public image URL.` and no button.

## Credential errors

When Telegram or Buffer credentials are missing, the API returns HTTP 500 with a clear message and
no database changes. The server action surfaces that message verbatim as an error flash, for
example `TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing` or
`BUFFER_ACCESS_TOKEN and the matching BUFFER_PROFILE_ID_* value are required for Buffer publishing`.
Platform-level outcomes are also surfaced: `published` becomes a success notice with the published
URL when one exists, while `skipped` and `failed` results are shown as error notices using their
API `errorMessage`.

## Why the scheduler does not publish

The Phase 12 scheduler deliberately excludes publishing jobs. Publishing is irreversible, the
Telegram and Buffer integrations are still untested against real credentials, and a scheduled
mistake would post publicly before a human notices. Keeping publishing manual means every public
post is a deliberate click (or explicit API call) after human approval.

## Known limitation

There is still no authentication. Anyone who can reach the dashboard can approve and publish
drafts, so do not expose the web app or API publicly until authentication lands.
