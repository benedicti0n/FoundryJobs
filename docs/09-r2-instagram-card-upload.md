# R2 Instagram Card Upload

Phase 9 uploads locally rendered Instagram card PNGs to Cloudflare R2 and replaces
`generated_posts.image_url` with a stable public URL. Instagram publishing is still a separate,
later phase.

## Why R2 upload exists

Locally rendered cards live under `apps/web/public/generated/instagram-cards/`, which only works on
the machine that rendered them and only while the Next.js app serves that directory. A public
object store gives every card a durable, CDN-friendly URL that social publishing tools can fetch
later, survives redeploys, and can be cached aggressively. R2 is S3-compatible, so the uploader uses
the standard AWS SDK with a custom endpoint and no vendor lock-in beyond the credentials.

## Local image_url vs public image_url

- **Local image URL**: `/generated/instagram-cards/instagram-card-<generatedPostId>.png`. This is
  what Phase 8 writes after rendering; the file lives in the repo's web `public` directory.
- **Public image URL**: `<R2_PUBLIC_BASE_URL>/foundryjobs/instagram-cards/instagram-card-<generatedPostId>.png`.
  This is what the uploader writes after a successful upload.

The uploader only picks up rows whose `image_url` starts with `/generated/instagram-cards/`, so a
second run naturally skips rows that already point at R2 (or any other remote URL). `image_url`
doubles as the "where is this card" pointer and as the upload state.

## Required environment variables

| Variable               | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account id used for the S3 endpoint.             |
| `R2_ACCESS_KEY_ID`     | R2 access key id.                                           |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key.                                       |
| `R2_BUCKET_NAME`       | Target bucket.                                              |
| `R2_PUBLIC_BASE_URL`   | Public bucket base URL used to build the returned card URL. |

All five are required. The storage client never reads them at import time, so the API and worker
start without them; at call time a missing variable throws
`R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL are required for R2 uploads`,
no database row is modified, and the worker exits 1 before touching the data.

## Object key format

```text
foundryjobs/instagram-cards/instagram-card-<generatedPostId>.png
```

Uploads use `Content-Type: image/png` and `Cache-Control: public, max-age=31536000, immutable`, so
regenerating a card reuses the same key and relies on the immutable cache policy. Error messages are
sanitized to avoid leaking signed query parameters or credentials.

## Worker command

```bash
# Upload up to 10 local Instagram cards
pnpm --filter @foundryjobs/worker upload-instagram-cards:once

# Override the batch size (1-200)
UPLOAD_INSTAGRAM_CARDS_LIMIT=25 pnpm --filter @foundryjobs/worker upload-instagram-cards:once
```

The worker exits 1 when `DATABASE_URL` or any R2 variable is missing (before modifying the
database), exits 0 when a run completes even if individual uploads fail, and prints a per-card
result with the public URL or the error message.

## API endpoint

```bash
# Upload one Instagram card to R2
curl -X POST http://localhost:4000/v1/generated-posts/<id>/upload/instagram-card
```

Responses are `{ "data": InstagramCardUploadResult }` with status `uploaded`, `skipped`, or `error`.
Chosen behaviors, documented for consistency with the rest of the API:

- a missing generated post returns **HTTP 404** `Generated post not found`;
- a non-Instagram post returns a **200 skipped** result (the platform check runs before the R2
  configuration check so this path works even without R2 credentials);
- an Instagram card whose `image_url` is already remote returns a **200 skipped** result with
  `Image URL is already remote or unsupported`;
- a missing local PNG file returns **status `error` inside the 200 response** rather than an HTTP
  500, because the request itself was valid;
- missing R2 variables on an Instagram card return **HTTP 500** with the R2 configuration message
  and do not modify the database.

## Non-goals for this phase

- No Instagram publishing; uploading only makes the card available at a public URL.
- No AI image generation; cards are still rendered by the Phase 8 SVG template.
- No scheduling or cron; uploads run manually.
- No authentication yet, so the upload endpoint should not be exposed publicly.
