# Instagram Card Renderer

Phase 8 renders premium 1080x1080 Instagram job cards as PNG files from generated Instagram drafts.
Cards are deterministic template renders; nothing is published to Instagram and no AI image
generation is used.

## Why template rendering instead of AI image generation

- Templates are deterministic: the same job always produces the same card, which makes review,
  caching, and debugging possible.
- They are free and fast, with no per-image cost and no model latency.
- They cannot hallucinate text, logos, or numbers because every element comes from stored job data.
- Brand consistency is guaranteed by the template; AI image models would need heavy guardrails to
  avoid garbled text on image.
- The layout is pure SVG, which is easy to review and version in git.

The implementation lives in `packages/card-renderer`: `format-card-data.ts` prepares a view model
from `RenderableInstagramPostDto`, `instagram-card-template.ts` builds an SVG string, and
`render-instagram-card.ts` rasterizes it to PNG with `sharp` (no browser, no headless Chromium).

## Card design

- 1080x1080 square, soft diagonal gradient background (lime to sky) with three blurred colour
  blobs for depth.
- Large frosted-glass card (rounded corners, 86% white, subtle border) with 60px inner padding.
- Brand row: a lime "FJ" logo placeholder, the FoundryJobs wordmark, and a badge that reads
  `Internship`, `Fresher Role`, or `Tech Role` based on the job data.
- Minimal black typography: eight-weight role title with automatic wrapping (up to three lines,
  ellipsis when longer), company name, and a detail block for Experience, Location, Work mode (only
  when known), and Skills (only when present).
- A dark "Apply Now" call-to-action pill in lime text and the footer line
  "Fresh tech hiring alerts".
- Missing values fall back to `Company not specified`, `Location not specified`, or
  `Not specified`, and no `null` or `undefined` strings can appear because all text is passed
  through formatting fallbacks and XML escaping.

## Local output path

Cards are written to `apps/web/public/generated/instagram-cards/` with the deterministic filename
`instagram-card-<generatedPostId>.png`, so the Next.js web app serves them at
`/generated/instagram-cards/instagram-card-<generatedPostId>.png`. The directory is created on
demand and ignored by git (`apps/web/public/generated/` is in `.gitignore`). Set
`INSTAGRAM_CARD_OUTPUT_DIR` to override the output directory (absolute or relative to the current
working directory).

The repo root is discovered by walking up from the current working directory to the nearest
`pnpm-workspace.yaml`, so the worker, the API, and local scripts all write to the same place
regardless of their working directory.

## imageUrl update flow

1. `listInstagramPostsNeedingCards` selects `generated_posts` rows with
   `platform = "instagram"`, `image_url IS NULL`, and status `draft` or `approved`, joined with the
   job post and its latest score.
2. The renderer formats the view model, builds the SVG, rasterizes it to PNG, and writes the file.
3. `updateGeneratedPostImageUrl` stores the public path in `generated_posts.image_url` and bumps
   `updated_at`.
4. Re-running the worker skips posts that already have an `image_url`; the single-post API accepts
   `regenerate: true` to overwrite an existing card.

## Worker command

```bash
# Render cards for up to 10 Instagram posts that have no image yet
pnpm --filter @foundryjobs/worker render-instagram-cards:once

# Override the batch size (1-200)
RENDER_INSTAGRAM_CARDS_LIMIT=25 pnpm --filter @foundryjobs/worker render-instagram-cards:once
```

The worker exits 1 when `DATABASE_URL` is missing and exits 0 when a run completes even if
individual cards fail.

## API endpoint

```bash
# Render a card for one Instagram generated post
curl -X POST http://localhost:4000/v1/generated-posts/<id>/render/instagram-card

# Regenerate (overwrite) an existing card
curl -X POST http://localhost:4000/v1/generated-posts/<id>/render/instagram-card \
  -H "content-type: application/json" \
  -d '{"regenerate":true}'
```

Responses are `{ "data": InstagramCardRenderResult }` with status `rendered`, `skipped` (wrong
platform, wrong status, or an existing image without `regenerate`), or `error`. Invalid UUIDs and a
non-boolean `regenerate` return 400, and a missing generated post returns 404. Cards are also
visible as thumbnails on the `/generated-posts` dashboard page.

## Non-goals for this phase

- No Instagram publishing; cards are only rendered and stored locally.
- No Cloudflare R2 upload; files live on the local disk under `apps/web/public/generated/`.
- No AI image generation.
- No scheduling or cron; rendering runs manually.
- No authentication.
