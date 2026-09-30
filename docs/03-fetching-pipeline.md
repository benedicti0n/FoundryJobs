# Fetching Pipeline

The fetching pipeline turns registered sources into stored raw posts. It runs on demand through the
worker (`fetch:once`) or per source through the API; there is no scheduler yet.

## Why ATS fetchers are first

Greenhouse, Lever, and Ashby publish public JSON job APIs. They are the first targets because:

- the data is structured, so extracting title, location, department, and description needs no
  HTML heuristics;
- one adapter per provider serves every company on that provider;
- the endpoints are public and stable, with no authentication and no anti-bot arms race;
- early-career roles are usually posted there first, before aggregators pick them up.

## Fetcher interface

```ts
type SourceFetcher = {
  platform: SourcePlatform;
  fetch(source: SourceDto): Promise<RawFetchedPost[]>;
};
```

The registry (`packages/fetchers/src/registry.ts`) maps `source.platform` to a fetcher. Unsupported
platforms return `null`, and fetch runs report those sources with status `unsupported` instead of
failing the run.

## Supported URL formats

| Platform   | Public URL                                                                    | API endpoint used                                                           |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Greenhouse | `https://boards.greenhouse.io/{boardToken}` (also `job-boards.greenhouse.io`) | `https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs?content=true` |
| Lever      | `https://jobs.lever.co/{company}`                                             | `https://api.lever.co/v0/postings/{company}?mode=json`                      |
| Ashby      | `https://jobs.ashbyhq.com/{org}`                                              | `https://api.ashbyhq.com/posting-api/job-board/{org}`                       |

The API URLs themselves can also be registered as source URLs
(`boards-api.greenhouse.io/v1/boards/{token}`, `api.lever.co/v0/postings/{company}`,
`api.ashbyhq.com/posting-api/job-board/{org}`); the fetchers recognize both forms.

## Raw post extraction

Each fetch produces `RawFetchedPost` values with `externalId`, `rawUrl`, `rawTitle`, `rawText`,
`rawHtml` when the provider supplies HTML, and `postedAt` when the provider exposes a
publish/update date. `rawText` contains the title, company/source name, location, department or
categories, and the description as plain text.

`rawText` deliberately excludes timestamps and other volatile fields so the derived content hash
stays stable across fetches of an unchanged posting.

## raw_posts storage

`raw_posts` keeps fetched content exactly as it arrived, before any interpretation: `source_id`,
`external_id`, `raw_url`, `raw_title`, `raw_text`, `raw_html`, `content_hash`, `posted_at`,
`fetched_at`, `status` (defaults to `new`), and `error_message`. It is the evidence layer; turning
raw posts into normalized `job_posts` happens in a later phase.

## Dedupe by content hash

`createContentHash` (in `packages/shared/src/fetching.ts`) is a deterministic SHA-256 hash of
`rawText`. `createRawPostIfNotExists` inserts with `onConflictDoNothing` against the unique
`content_hash` index and returns `{ inserted: false }` for duplicates without throwing. Because the
hash is global, the same posting fetched from two different sources counts as one raw post.

`raw_posts.posted_at` stores the provider's posted/updated date when available;
`raw_posts.fetched_at` records when FoundryJobs fetched the row.

## Due-source logic

`listActiveSourcesDueForFetch(now)` selects sources where `is_active = true` and `last_fetched_at`
is `null` or older than `fetch_interval_minutes`. Results are ordered with never-fetched sources
first, then oldest first.

There is no cron yet: `fetch:once` fetches every source that is due at that moment, and
`POST /v1/sources/:id/fetch` bypasses the interval for a manual single-source fetch.
`last_fetched_at` updates only after a fetch that did not throw.

## Run summary and failure isolation

`fetchDueSources()` returns a `FetchRunSummary` with per-source `FetchSourceResult` entries
(status, fetched/inserted/duplicate counts, error message, timestamps). A failing source never stops
the run; the worker prints the summary and exits 0 even when individual sources fail, and exits 1
only for fatal problems such as a missing `DATABASE_URL`.

Manual fetches of paused sources are reported as `skipped` and do not touch the database.

## Why AI normalization is delayed until Phase 4

Raw text is stored before AI extraction for four reasons:

- extraction costs tokens, so it should run once per unique post, after dedupe;
- extraction prompts will improve over time, and re-running them should not require re-fetching;
- raw storage is the audit trail for debugging bad extractions;
- fetching and AI have different failure modes and are easier to operate separately.

Phase 4 will read `raw_posts` with status `new` and produce normalized `job_posts`; the same
pipeline will then mark raw rows `normalized`, `rejected`, or `error`.

## Known non-goals

- No LinkedIn scraping: LinkedIn terms prohibit it and its data is duplicated on ATS boards.
- No X scraping yet: X sources are registered as `x_search` but not fetched in this phase.
- No Telegram channel ingestion yet: `telegram_channel` sources are stored but not fetched.
- No browser automation: every fetcher uses plain HTTP JSON endpoints; no headless browsers.
- No scheduled cron yet: fetch runs are manual (`fetch:once` or the per-source API endpoint).
- No Workable fetcher yet: `workable` sources are reported as `unsupported` until one is added.
