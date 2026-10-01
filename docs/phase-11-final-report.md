# Phase 11 — Dashboard Approval Actions: Final Report

## Files created/changed (full paths)

**Commit 1 — web**

- Created: `apps/web/src/lib/api.ts`
- Created: `apps/web/src/app/approval-queue/actions.ts`
- Modified: `apps/web/src/app/approval-queue/page.tsx`
- Modified: `apps/web/src/components/notice.tsx`

**Commit 2 — web**

- Modified: `apps/web/src/app/generated-posts/page.tsx`
- Modified: `apps/web/src/app/approval-queue/actions.ts` (prettier-only import collapse carried over from commit 1)

**Commit 3 — docs**

- Created: `docs/11-dashboard-approval-actions.md`
- Modified: `README.md`

No API or worker changes were needed; the optional `fix(api)` commit was not required because the existing endpoints accepted the dashboard payloads unchanged.

## Commands run

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm exec prettier --check .`, `node apps/api/dist/index.js` runtime smoke tests, `next start` render tests for `/approval-queue`, `/generated-posts`, and `/` with and without `API_BASE_URL`, no-JS form POSTs with curl against the rendered server-action forms (including extracting the `$ACTION_ID` field from the HTML), `psql` state verification against `foundryjobs_dev`, `node apps/worker/dist/index.js` default boot regression, and `pnpm --filter @foundryjobs/worker normalize:once` no-database regression.

## Typecheck / build / lint / format status

All pass at final HEAD. Typecheck succeeds for all seventeen workspace packages (`shared`, `ai`, `scoring`, `db`, `fetchers`, `normalizer`, `post-generator`, `telegram`, `publisher`, `card-renderer`, `storage`, `card-uploader`, `buffer`, `buffer-publisher`, `web`, `api`, `worker`) with zero errors. Build succeeds for `apps/web`, `apps/api`, and `apps/worker`. ESLint reports zero findings, `prettier --check .` reports all matched files use Prettier code style, the frozen install is clean, and the git tree is clean.

## Web render/action test results

With `API_BASE_URL` and `DATABASE_URL`, `/approval-queue` rendered 5 draft cards (after the test actions) each with a platform badge, company and role, score, status, created and updated timestamps, text preview, optional image link, an editable textarea, and four submit buttons (`Approve`, `Reject`, `Needs edit`, `Save text`). The rendered forms were also functional through the no-JS progressive-enhancement path: POSTing the exact form payload with the extracted `$ACTION_ID_4083d365006ed06c12cbab45fe1a7a6fbb8dca0bf7` field executed the real Next.js server action, returned `303 See Other` with a `Location` header, and carried out the API calls server-side.

- `Save text` on a LinkedIn draft updated `text_content` to `Updated from dashboard smoke test` and returned `/approval-queue?message=Draft+text+saved`.
- `Needs edit` on a LinkedIn draft returned `?message=Decision+recorded%3A+needs_edit`, updated the text, kept the post in `draft`, and recorded `needs_edit by dashboard notes=Marked from dashboard`.
- `Approve` on a LinkedIn draft returned `?message=Decision+recorded%3A+approved`, set the post to `approved`, and updated its text.
- `Reject` on a Telegram draft returned `?message=Decision+recorded%3A+rejected` and set the post to `rejected`.
- `Save text` with only whitespace returned `?error=Draft+text+cannot+be+empty`, left the text unchanged, and inserted no approval row.
- The success and error flash notices rendered on the page (`Decision recorded: approved`, `Draft text cannot be empty`), and after the actions the queue re-rendered with 5 remaining drafts while the approved post disappeared from it.
- Without `API_BASE_URL`, `/approval-queue` rendered the `API not configured` notice and the home page returned HTTP 200.

## API smoke test results

Regressions at HEAD with the API running: `GET /health` returned 200, `GET /v1/approval-queue` returned 200, `GET /v1/generated-posts` returned 200, and `GET /v1/publish-events` returned 200. The dashboard actions produced exactly the specified API calls (`PATCH /v1/generated-posts/:id/text` and `POST /v1/generated-posts/:id/approval` with `decidedBy: "dashboard"`), and no API validation was weakened or bypassed.

## Number of dashboard actions tested

5 dashboard actions were executed through the rendered form path: 2 `Save text` actions (one on a LinkedIn draft, one on the X draft at final HEAD), 1 `Needs edit`, 1 `Approve`, and 1 `Reject`, plus 1 empty-text `Save text` negative test that correctly failed.

## Approvals rows inserted during tests

3 approvals rows were inserted by the dashboard actions (one `approved`, one `rejected`, one `needs_edit`, all with `decided_by = dashboard`), taking the table from 7 to 10 rows. The two text saves and the rejected empty save inserted no approval rows, as expected.

## Generated post status changes verified

`d0964b1c-3cc5-4b52-a085-cd735764012d` moved from `draft` to `approved` with updated text; `0defc931-36ed-4d9d-8341-8279a185cc8f` moved from `draft` to `rejected`; `d8033da3-2a8f-43d5-a5d5-e5126fdda14a` stayed `draft` with updated text and a `needs_edit` decision; `0100a8b0-1789-4c5d-8ad2-3c844d58bfa5` stayed `draft` with updated text; `e1266fdb-1a4e-4581-9bb0-6f7b6d86bf65` stayed `draft` and unchanged after the failed empty save. Final database state: 4 approved, 5 draft, 3 rejected, and 10 approval rows.

## DATABASE_URL availability

Yes. Homebrew PostgreSQL 16.14 is running on `127.0.0.1:5432` and the scratch database `foundryjobs_dev` holds the full Phase 3–11 state: 61 raw posts, 22 job posts, 22 scores, 12 generated posts, 10 approval rows, and 0 publish events. It is local-only test state and can be dropped with `dropdb foundryjobs_dev`.

## API_BASE_URL availability during web tests

Yes, the action tests ran with `API_BASE_URL=http://127.0.0.1:4000`. The fallback path (no `API_BASE_URL`) was tested separately and rendered the `API not configured` notice without crashing.

## Commit hashes and messages

| Hash      | Message                                           |
| --------- | ------------------------------------------------- |
| `2b7dba1` | feat(web): add approval queue actions             |
| `7e87e73` | feat(web): improve generated posts approval links |
| `e138e8d` | docs: document dashboard approval actions         |

Commit 2 also contains a prettier-only import collapse in `apps/web/src/app/approval-queue/actions.ts` that should have been formatted into commit 1; the behavioral change in commit 2 is only the generated-posts review link.

## Known issues

1. Full browser-click testing was not performed because no browser automation is available, so the actions were verified by rendering the forms and POSTing their exact no-JS payloads, including the `$ACTION_ID` field, with curl.
2. There is still no authentication, so anyone who can reach the dashboard can approve or reject drafts and `decidedBy` is always the hardcoded string `dashboard`.
3. Server action feedback travels through redirect query parameters, so success and error messages live in the URL, vanish on navigation, and can be replayed by refreshing the URL.
4. The action layer sends the current textarea content with approvals whenever it is non-empty, so approving after editing both updates the text and records the decision in a single API call instead of a separate save.
5. The approval queue page loads every draft in a single request with no pagination, so a large queue renders as a long page with one form per draft.
6. The queue lists only `draft` status posts, so drafts that were already marked `needs_edit` are mixed with never-reviewed drafts and there is no filter or review counter.
7. The generated posts page links drafts to `/approval-queue` without anchoring to the specific draft, so reviewers must locate the matching card manually.
8. The new `apps/web/src/lib/api.ts` helper duplicates fetch and error handling that page-level loaders still implement separately, leaving two slightly different API error message paths in the web app.

## Next recommendations

- Add authentication and use the authenticated reviewer identity for `decidedBy` before exposing the dashboard beyond localhost.
- Add pagination or status filters to the approval queue and deep links that anchor to a specific draft.
- Consider inline action state instead of URL query parameters if flash messages should survive navigation cleanly.
- Proceed to Phase 12: scheduling/cron for the worker pipelines, or dashboard publish buttons for approved drafts.
- Add a Playwright end-to-end test for the real click path once authentication exists.
