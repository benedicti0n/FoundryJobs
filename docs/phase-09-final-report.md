# Phase 9 — Cloudflare R2 Upload for Instagram Cards: Final Report

## Files created/changed (full paths)

**Commit 1 — shared**

- Created: `packages/shared/src/storage.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — db**

- Created: `packages/db/src/repositories/instagram-card-uploads.ts`
- Modified: `packages/db/src/index.ts`

**Commit 3 — storage**

- Created: `packages/storage/package.json`
- Created: `packages/storage/tsconfig.json`
- Created: `packages/storage/src/r2-client.ts`
- Created: `packages/storage/src/paths.ts`
- Created: `packages/storage/src/upload.ts`
- Created: `packages/storage/src/index.ts`
- Modified: `.env.example`
- Modified: `pnpm-lock.yaml`

**Commit 4 — card-uploader**

- Created: `packages/card-uploader/package.json`
- Created: `packages/card-uploader/tsconfig.json`
- Created: `packages/card-uploader/src/local-paths.ts`
- Created: `packages/card-uploader/src/upload-instagram-card.ts`
- Created: `packages/card-uploader/src/upload-run.ts`
- Created: `packages/card-uploader/src/index.ts`
- Modified: `pnpm-lock.yaml`

**Commit 5 — worker**

- Modified: `apps/worker/src/index.ts`
- Modified: `apps/worker/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 6 — api**

- Modified: `apps/api/src/routes/generated-posts.ts`
- Modified: `apps/api/package.json`
- Modified: `pnpm-lock.yaml`

**Commit 7 — web**

- Modified: `apps/web/src/app/generated-posts/page.tsx`

**Commit 8 — docs**

- Created: `docs/09-r2-instagram-card-upload.md`
- Modified: `README.md`

## Commands run

`pnpm install` (after each dependency change), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `pnpm --filter @foundryjobs/worker upload-instagram-cards:once` (without `DATABASE_URL`, and with `DATABASE_URL` but no R2 env), `node apps/worker/dist/index.js upload-instagram-cards:once` (built bundle config-missing check), `node apps/worker/dist/index.js` default boot regression, `pnpm --filter @foundryjobs/worker render-instagram-cards:once` regression, `node apps/api/dist/index.js` runtime smoke tests (without `DATABASE_URL`, and with `DATABASE_URL` but no R2 env), `curl` against the new upload endpoint and the Phase 6–8 regression endpoints, `next start` render test for `/generated-posts` verifying image URL links, `psql` state verification against `foundryjobs_dev`, and temporary smoke scripts inside `packages/storage`, `packages/db`, and `packages/card-uploader` (deleted, never committed).

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all fifteen workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `telegram`, `publisher`, `card-renderer`, `storage`, `card-uploader`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## API smoke test results

Without `DATABASE_URL`: `GET /health` returns `{"ok":true,"service":"foundryjobs-api"}`; `POST /v1/generated-posts/00000000-0000-4000-8000-000000000000/upload/instagram-card` returns HTTP 500 `{"error":{"message":"DATABASE_URL is required for Instagram card upload repository operations"}}`; a non-UUID id returns HTTP 400 `id must be a valid UUID`.

With `DATABASE_URL` but no R2 env: uploading the approved Instagram card returns HTTP 500 `{"error":{"message":"R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL are required for R2 uploads"}}`; uploading a Telegram post returns `{"data":{"status":"skipped","errorMessage":"Platform telegram is not supported by the Instagram card uploader"}}` with HTTP 200; a missing generated post returns HTTP 404 `Generated post not found`. Regressions `GET /v1/approval-queue` and `GET /v1/publish-events` still return HTTP 200, and `GET /v1/generated-posts?platform=instagram` still returns the 2 local image URLs.

## Worker upload-instagram-cards:once test result

Without `DATABASE_URL` it prints `DATABASE_URL is required to run upload-instagram-cards:once. Set it in the environment or the root .env file.` and exits 1. With `DATABASE_URL` but no R2 env it prints `R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL are required for R2 uploads. No cards were uploaded.` and exits 1 before touching the database, verified both through the tsx script path and the built `node dist/index.js` bundle. Default worker boot still logs `FoundryJobs worker booted` / `No scheduled jobs registered yet`, and `render-instagram-cards:once` still runs (`Processed 0 Instagram posts`).

## R2 environment availability

No. `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` are all unset and there is no root `.env` file, so no live upload could be performed.

## Whether an actual R2 upload happened

No actual R2 upload happened, and no success was faked. Per the phase instructions, only config-missing behavior was tested: the storage client is import-safe, `isR2Configured()` returns false, `getR2Config()` and `uploadFileToR2()` throw the exact required message, the single-card uploader returns `status: "error"` with that message and leaves `image_url` unchanged, and the run function fails fast with the same message before any database mutation. A temporary remote URL was used to verify the "already remote" skip path and then restored.

## Local Instagram card image URLs before upload

There were 2 local Instagram card image URLs before upload: the approved card at `/generated/instagram-cards/instagram-card-58f4fc2d-08a5-4497-9d87-55defddc22df.png` and the draft card at `/generated/instagram-cards/instagram-card-1b70f878-5485-4b89-bf36-971acf57634a.png` (the rejected Instagram post has `NULL`).

## R2 uploads completed

0 R2 uploads completed, because the credentials were unavailable. All upload code paths were exercised as far as possible without credentials, including selection (2 local cards), the remote-URL exclusion (temporarily setting a remote URL reduced the pending list from 2 to 1 and restoring it returned the list to 2), the platform skip, the missing-file/not-found errors, and the fail-fast run check.

## generated_posts image_url values updated to remote URLs

0 `generated_posts.image_url` values were updated to remote URLs; the final database state is 0 remote URLs and 2 local URLs for Instagram posts, unchanged from before the phase.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–9 state: 61 raw posts, 22 job posts, 22 scores, 12 generated posts (2 Instagram cards with local image paths), 7 approval rows, and 0 publish events. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## Commit hashes and messages

| Hash      | Message                                                 |
| --------- | ------------------------------------------------------- |
| `8bfc5fb` | feat(shared): add Instagram card upload types           |
| `d2e2dce` | feat(db): add Instagram card upload repositories        |
| `e6e7c51` | feat(storage): add Cloudflare R2 upload client          |
| `297960a` | feat(card-uploader): add Instagram card upload pipeline |
| `42af84d` | feat(worker): add Instagram card upload command         |
| `976de37` | feat(api): add Instagram card upload endpoint           |
| `fe85ddd` | feat(web): improve generated post image links           |
| `0a022e7` | docs: document R2 card uploads                          |

## Known issues

1. No actual R2 upload was exercised because none of the R2 variables were available, so the PutObject call, public URL construction, and cache headers remain untested against a real bucket.
2. The AWS SDK is pinned exactly to `3.1143.0` in three package manifests because the newest patch was younger than pnpm's one-day release-age guard, which will require manual version bumps.
3. `@aws-sdk/client-s3` and `sharp` are declared as runtime dependencies in `apps/worker` and `apps/api` so their bundled code can resolve them externally, duplicating dependency declarations in packages that only use them transitively.
4. The uploader resolves the local file from the default repo output directory or `INSTAGRAM_CARD_OUTPUT_DIR`, so mismatched overrides between rendering and uploading produce a local-file-not-found error.
5. Regenerated cards reuse the same R2 object key while the upload sets an immutable one-year cache policy, so a stale card can be served from the public URL until the cache is purged.
6. The API checks the R2 configuration for every Instagram card before calling the uploader, so an already-remote card returns HTTP 500 rather than a skipped result when credentials are missing.
7. There is no post-upload verification that the object is publicly readable, so a misconfigured `R2_PUBLIC_BASE_URL` would silently store broken URLs in `image_url`.
8. Upload attempts and failures are not persisted anywhere, leaving only console output as evidence of what happened during a run.

## Next recommendations

- Configure real R2 credentials and run a single end-to-end upload to verify PutObject, public URL construction, and cache headers, then re-run to confirm remote URLs are skipped.
- Proceed to Phase 10: Instagram publishing using the public card URL, or X/LinkedIn publishing, reusing the approved-only rule and publish_events audit trail.
- Persist upload attempts and failures (for example in a storage_events table) so upload observability matches publishing.
- Add cache purge or versioned object keys for regenerated cards.
- Add authentication before exposing the upload endpoint beyond localhost.
