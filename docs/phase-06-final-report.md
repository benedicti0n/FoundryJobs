# Phase 6 — Approval Queue: Final Report

## Files created/changed (full paths)

**Extra commit (untracked file from the previous phase)**

- Created: `docs/phase-05-final-report.md`

**Commit 1 — shared**

- Created: `packages/shared/src/approvals.ts`
- Modified: `packages/shared/src/index.ts`

**Commit 2 — db**

- Created: `packages/db/src/repositories/approvals.ts`
- Modified: `packages/db/src/repositories/generated-posts.ts`
- Modified: `packages/db/src/index.ts`

**Commit 3 — api**

- Created: `apps/api/src/routes/approvals.ts`
- Modified: `apps/api/src/routes/list-query.ts`
- Modified: `apps/api/src/index.ts`

**Commit 4 — web**

- Created: `apps/web/src/app/approval-queue/page.tsx`
- Modified: `apps/web/src/app/page.tsx`

**Commit 5 — docs**

- Created: `docs/06-approval-queue.md`
- Modified: `README.md`

## Commands run

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `node apps/api/dist/index.js` runtime smoke tests (without and with `DATABASE_URL`), `node apps/worker/dist/index.js` boot smoke test, `pnpm --filter @foundryjobs/worker generate-posts:once` (Phase 5 regression, without `DATABASE_URL`), `curl` calls for every new and existing endpoint including the full approval flow (edit, approve, reject, needs_edit, empty-text guard, filters, 400/404 cases), `next start` render tests for `/approval-queue` and `/` with and without `API_BASE_URL`, `psql` state verification against `foundryjobs_dev`, and temporary smoke scripts inside `packages/db` (deleted, never committed).

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all ten workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## API smoke test results

Without `DATABASE_URL`: `GET /health` returns `{"ok":true,"service":"foundryjobs-api"}`; `GET /v1/approval-queue` returns HTTP 500 `{"error":{"message":"DATABASE_URL is required for approval repository operations"}}`; `GET /v1/generated-posts/:id`, `PATCH /v1/generated-posts/:id/text`, and `POST /v1/generated-posts/:id/approval` with valid bodies and UUIDs return HTTP 500 with the same clear message; `GET /v1/approval-queue?platform=bad` and `?status=bad` return HTTP 400 with explicit allowed-value lists; `PATCH .../text` with a whitespace-only body returns HTTP 400 `{"error":{"message":"textContent must be a non-empty string"}}`; `POST .../approval` with a bad decision returns HTTP 400 `{"error":{"message":"decision must be one of: approved, rejected, needs_edit"}}`; a non-UUID id returns HTTP 400 `id must be a valid UUID`; the server shuts down gracefully and never crashes.

With `DATABASE_URL`: `GET /v1/approval-queue` returned 10 drafts with platform, company, role, and score; `GET /v1/generated-posts/:id` returned a draft; `PATCH .../text` updated the text with `updatedAt > createdAt`; `POST .../approval` with `needs_edit` and new text returned `decision: needs_edit`, `generatedPostStatus: draft`, a recorded approval, and the updated text; `approved` returned status `approved`; `rejected` returned status `rejected`; `GET /v1/approval-queue?status=approved` returned 2 rows; approving a draft whose text was emptied returned HTTP 400 `{"error":{"message":"Cannot approve a generated post with empty text"}}`; Phase 5 endpoints still work (`GET /v1/generated-posts?limit=2` returned 200 and `POST /v1/job-posts/:id/generate-posts` on an already-generated job returned `skipped — Generated posts already exist for this job`).

## Web approval queue render result

`/approval-queue` rendered with the heading `Approval Queue`, the subtitle `Review generated drafts before publishing.`, all 8 waiting drafts as cards (platform badge, company and role, score, status, preview, created date), and quick links to `/generated-posts`, `/job-posts`, and `/sources`. The home page links to `/approval-queue` and shows the `Phase 6 · Approval Queue` badge. Without `API_BASE_URL`, the page rendered the `API not configured` notice instead of failing.

## Drafts before approval tests

12 draft generated posts existed before the approval tests began (the Phase 5 output of 3 eligible jobs × 4 platforms).

## Approved, rejected, and needs_edit recorded

The repository tests produced 1 approved, 1 rejected, and 1 needs_edit decision; the API tests produced 1 approved, 1 rejected, and 1 needs_edit decision. Final totals: 2 approved, 2 rejected, and 2 needs_edit. The 2 needs_edit drafts remain in `draft` status by design, leaving 8 rows with status `draft` (12 minus 2 approved minus 2 rejected).

## Approvals rows inserted

6 approvals rows were inserted in total, with an equal split of 2 rows per decision (`approved`, `rejected`, `needs_edit`). SQL verified `approvals=6`, and 7 generated_posts rows show `updated_at > created_at` for the drafts touched by edits, decisions, or the empty-text guard test.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–6 state: 61 raw posts, 22 job posts, 22 scores, 12 generated posts (8 draft, 2 approved, 2 rejected), and 6 approval rows. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## Commit hashes and messages

| Hash      | Message                                   |
| --------- | ----------------------------------------- |
| `1af2115` | docs: add phase 5 final report            |
| `5a978b9` | feat(shared): add approval workflow types |
| `967dd8f` | feat(db): add approval repositories       |
| `b589cbc` | feat(api): add approval queue endpoints   |
| `f7d94e8` | feat(web): add approval queue page        |
| `bc2d8b7` | docs: document approval queue             |

The `1af2115` commit is the previously untracked `docs/phase-05-final-report.md` file created at your request, committed separately per the project's rule of one focused change per commit.

## Known issues

1. The dashboard approval page is read-only, so approving, rejecting, and editing still require direct API calls until authenticated dashboard actions are built.
2. The approval endpoints have no authentication, so `decidedBy` is free text and anyone with network access to the API can approve or reject drafts.
3. Because the queue defaults to `draft` and `needs_edit` keeps that status, a draft can cycle through repeated `needs_edit` decisions indefinitely without any counter or escalation path.
4. Approving an already approved or rejected draft is allowed and appends another approvals row, so the workflow does not enforce monotonic status transitions.
5. Approval rows reference `job_post_id` rather than the specific generated post, so reconstructing which platform draft a decision applied to requires correlating timestamps with `generated_posts`.
6. The `updated_at` change is applied by application code rather than a database trigger, so any future direct SQL modification would bypass it.
7. The web page fetches only the default draft page with no pagination or filters, so a large queue would render as one long page.
8. Each approval action now reads the generated post twice (once in the API for 404 handling and once inside the repository), which is a small redundant query per decision.

## Next recommendations

- Build Phase 7 publishing: send approved drafts to Telegram first and record attempts in `publish_events`, keeping publishing idempotent and auditable.
- Add authentication and reviewer accounts before the approval API is exposed beyond localhost, and use the authenticated identity for `decidedBy`.
- Add dashboard approve, reject, and edit actions (server actions or a small client component) so reviewers do not need curl.
- Consider a `generated_post_id` column on `approvals` (or a dedicated decision-target column) for precise audit queries.
- Add pagination and platform/status filters to the approval queue page, and a retry path for drafts stuck in `needs_edit`.
