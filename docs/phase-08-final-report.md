# Phase 8 — Instagram Job Card Renderer: Final Report

## Files created/changed (full paths)

**Commit 1 — shared**

- Created: `packages/shared/src/card-rendering.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — db**

- Created: `packages/db/src/repositories/instagram-cards.ts`
- Modified: `packages/db/src/index.ts`

**Commit 2b — db (platform support for the renderer)**

- Modified: `packages/db/src/repositories/instagram-cards.ts`

**Commit 3 — card-renderer**

- Created: `packages/card-renderer/package.json`
- Created: `packages/card-renderer/tsconfig.json`
- Created: `packages/card-renderer/src/format-card-data.ts`
- Created: `packages/card-renderer/src/instagram-card-template.ts`
- Created: `packages/card-renderer/src/render-instagram-card.ts`
- Created: `packages/card-renderer/src/render-run.ts`
- Created: `packages/card-renderer/src/index.ts`
- Modified: `.gitignore`
- Modified: `pnpm-lock.yaml`

**Commit 4 — worker**

- Modified: `apps/worker/src/index.ts`
- Modified: `apps/worker/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 5 — api**

- Modified: `apps/api/src/routes/generated-posts.ts`
- Modified: `apps/api/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 6 — web**

- Modified: `apps/web/src/app/generated-posts/page.tsx`

**Commit 7 — docs**

- Created: `docs/08-instagram-card-renderer.md`
- Modified: `README.md`

## Commands run

`pnpm install` (after each dependency change), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `node apps/worker/dist/index.js render-instagram-cards:once` (built bundle, with and without `DATABASE_URL`), `pnpm --filter @foundryjobs/worker render-instagram-cards:once` (tsx path, multiple runs with `RENDER_INSTAGRAM_CARDS_LIMIT`), `node apps/api/dist/index.js` runtime smoke tests (without and with `DATABASE_URL`), `curl` against `/health`, the render endpoint (normal, regenerate, non-Instagram, missing, bad UUID, bad regenerate), `GET /v1/generated-posts`, and Phase 6/7 regression endpoints, `next start` render tests for `/generated-posts` including fetching the served PNG, `file` and `sharp` metadata checks for image dimensions, `psql` state verification against `foundryjobs_dev`, and temporary smoke scripts inside `packages/card-renderer` and `packages/db` (deleted, never committed).

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all thirteen workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `telegram`, `publisher`, `card-renderer`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## API smoke test results

Without `DATABASE_URL`: `GET /health` returns `{"ok":true,"service":"foundryjobs-api"}`; `POST /v1/generated-posts/00000000-0000-4000-8000-000000000000/render/instagram-card` returns HTTP 500 `{"error":{"message":"DATABASE_URL is required for Instagram card repository operations"}}`; a non-UUID id returns HTTP 400 `id must be a valid UUID`; `{"regenerate":"yes"}` returns HTTP 400 `regenerate must be a boolean`; graceful shutdown is logged.

With `DATABASE_URL`: rendering an already-rendered Instagram post without `regenerate` returned `status: "skipped"` with `errorMessage: "Image already exists for this generated post"` and the existing image path; posting `{"regenerate":true}` returned `status: "rendered"` with the same path; rendering a Telegram post returned `status: "skipped"` with `Platform telegram is not supported by the Instagram card renderer`; rendering a missing valid UUID returned HTTP 404 `Generated post not found`; `GET /v1/generated-posts?platform=instagram` included `imageUrl` for both rendered posts and `null` for the rejected one; Phase 6/7 regressions `GET /v1/approval-queue` and `GET /v1/publish-events` still return HTTP 200.

## Worker render-instagram-cards:once test result

Without `DATABASE_URL` it prints `DATABASE_URL is required to run render-instagram-cards:once. Set it in the environment or the root .env file.` and exits 1. With `DATABASE_URL` and `RENDER_INSTAGRAM_CARDS_LIMIT=1` after clearing one `image_url`, it printed `FoundryJobs render-instagram-cards run complete (limit 1)` followed by `Processed 1 Instagram posts (rendered 1, skipped 0, errors 0)` and the rendered path. A subsequent default run printed `Processed 0 Instagram posts (rendered 0, skipped 0, errors 0)`, and the built worker bundle was also verified to run the command successfully after `sharp` was declared as a worker dependency so it stays external to the bundle.

## Instagram posts before rendering

There were 2 renderable Instagram generated posts before rendering (1 `draft` and 1 `approved`, both with `image_url IS NULL`), plus 1 `rejected` Instagram post that is correctly excluded by the repository selection. Both renderable posts belong to Discord job posts.

## PNGs rendered and output paths

2 PNG files were rendered and remain on disk:

- `apps/web/public/generated/instagram-cards/instagram-card-58f4fc2d-08a5-4497-9d87-55defddc22df.png` (the approved Software Engineer, Safety Processing card, 205833 bytes)
- `apps/web/public/generated/instagram-cards/instagram-card-1b70f878-5485-4b89-bf36-971acf57634a.png` (the draft Data Scientist - Client Platform card, 195287 bytes)

Additional renders (API regenerate and worker limit-1 run) overwrote these same deterministic filenames rather than creating new files.

## Image dimension verification result

Both PNGs were verified as exactly 1080x1080: `file` reports `PNG image data, 1080 x 1080, 8-bit/color RGBA, non-interlaced` for both, and `sharp` metadata during the render test reported `1080x1080 png`. Pixel-region checks confirmed the role title region contains the ink colour `rgb(15,23,42)` while a blank card region stays near-white, proving the SVG text actually rasterizes rather than rendering empty.

## generated_posts image_url values updated

2 `generated_posts` rows had `image_url` updated to their `/generated/instagram-cards/instagram-card-<id>.png` paths (one `approved`, one `draft`); the `rejected` Instagram post was left at `NULL`. A template-safety check confirmed the rendered SVG contains no `null` or `undefined`, and text wrapping with ellipsis works for long role titles.

## Duplicate-skip behavior

The worker only selects posts with `image_url IS NULL`, so re-running it processes 0 posts. The single-post API returns `status: "skipped"` with `Image already exists for this generated post` unless the request body sets `regenerate: true`, which re-renders and overwrites the deterministic filename and keeps the same `image_url` value in the database.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–8 state: 61 raw posts, 22 job posts, 22 scores, 12 generated posts (2 of the Instagram ones now carry image paths), 7 approval rows, and 0 publish events. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## Commit hashes and messages

| Hash      | Message                                                 |
| --------- | ------------------------------------------------------- |
| `91753f5` | feat(shared): add Instagram card render types           |
| `7f8a172` | feat(db): add Instagram card repositories               |
| `513749b` | feat(db): include platform in renderable Instagram post |
| `82737d1` | feat(card-renderer): add Instagram card renderer        |
| `5be7736` | feat(worker): add Instagram card render command         |
| `987c744` | feat(api): add Instagram card render endpoint           |
| `f324e04` | feat(web): show generated post image previews           |
| `56fc66e` | docs: document Instagram card renderer                  |

The extra `513749b` commit exists because the renderer must skip non-Instagram posts and the specified `RenderableInstagramPostDto` does not carry the platform field, so the database selection was extended with a `RenderableInstagramPost` type that adds `platform` without changing the shared DTO.

## Known issues

1. The renderer uses SVG plus `sharp` instead of the HTML/Playwright path the spec mentioned as an option, so any future HTML-based template work would need a migration.
2. `sharp` is now declared as a runtime dependency in `packages/card-renderer`, `apps/worker`, and `apps/api` because the bundled consumers must resolve the native module externally, which duplicates the same dependency declaration in three package manifests.
3. Font rendering depends on system fonts through librsvg/fontconfig, so cards rendered on a machine without a suitable sans-serif font could look different from the local output.
4. The default output directory is coupled to the web app (`apps/web/public/generated/instagram-cards`), and moving to object storage later means replacing this path resolution and rewriting stored `image_url` values.
5. Regeneration overwrites the PNG at the same deterministic filename, so there is no versioning or cache busting and a browser can display a stale thumbnail after a regenerate.
6. Rendered cards only include role, company, experience, location, work mode, and skills, while the DTO also carries salary, qualification, and score values that are not shown.
7. Render failures are returned in the run result but not persisted anywhere, so a failed card leaves no record and can only be rediscovered by re-running the command.
8. There is no lock around rendering, so two concurrent worker runs could both render the same post and write the same file.

## Next recommendations

- Proceed to the next phase: Instagram publishing or Cloudflare R2 upload of the rendered cards, reusing the deterministic filenames and `image_url` field.
- Persist render failures (for example an `error_message` on generated posts or a small render-run log) so failed cards are discoverable without console output.
- Consider `@resvg/resvg-js` with a bundled font if cross-machine typography consistency becomes a requirement.
- Add cache-busting to regenerated images (versioned filename or query string) before the web UI depends on them heavily.
- Add authentication before exposing the render endpoints beyond localhost, together with the other unauthenticated endpoints.
