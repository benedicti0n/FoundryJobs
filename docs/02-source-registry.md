# Source Registry

The source registry describes every place FoundryJobs will fetch hiring posts from. It is the input
to the future fetching pipeline and is managed through the API (`/v1/sources`) or the seed script.

## Source types

| Type               | What it is                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `ats`              | A job board hosted by an applicant tracking system (Greenhouse, Lever, Ashby, Workable, Workday). |
| `company_careers`  | A company's own careers page.                                                                     |
| `rss`              | An RSS/Atom feed from a job board or blog.                                                        |
| `web_page`         | A curated hiring page that needs light parsing.                                                   |
| `telegram_channel` | A public Telegram channel that posts hiring alerts.                                               |
| `x_search`         | A saved X search (planned).                                                                       |
| `manual`           | Entries added by hand.                                                                            |

## Source platforms

| Platform                                              | Notes                                      |
| ----------------------------------------------------- | ------------------------------------------ |
| `greenhouse`, `lever`, `ashby`, `workable`, `workday` | ATS providers with structured job data.    |
| `generic`                                             | Anything else: RSS feeds and career pages. |
| `telegram`                                            | Telegram channels.                         |
| `x`                                                   | X searches.                                |
| `manual`                                              | Manual submissions.                        |

## Why ATS sources are P0

ATS boards are the first fetch target because:

- they expose structured, machine-readable job data, so parsing is reliable and cheap;
- companies post early-career roles there first, often before aggregators pick them up;
- a single adapter per provider serves many companies because payload shapes are identical;
- they are public and stable, so there is no scraping arms race.

That is why the seed script ships with Greenhouse, Lever, and Ashby examples.

## Why LinkedIn scraping is not part of the MVP

LinkedIn is not a fetch source. Scraping it violates its terms of service, triggers anti-bot
defenses, and can get accounts banned. The data is also heavily duplicated from ATS boards, which
are legitimate sources. LinkedIn is planned as a **publishing target only**, and even then through
compliant channels. The MVP non-goals list this explicitly (see
[docs/00-project-overview.md](00-project-overview.md)).

## How sources flow into future fetching

1. The worker reads active sources, ordered by `last_fetched_at`, and skips sources whose
   `fetch_interval_minutes` has not elapsed since the last fetch.
2. Each fetch stores content in `raw_posts` with a `content_hash` for deduplication.
3. Normalization turns raw posts into `job_posts`; failures are recorded on the raw row.
4. Scoring writes `job_scores`, and generation writes `generated_posts` in later phases.

`trust_level` (0–100) will influence fetch priority and scoring: higher-trust sources get fetched
more often and their posts score higher.

## Managing sources through the API

```bash
# Create
curl -X POST http://localhost:4000/v1/sources \
  -H "content-type: application/json" \
  -d '{"name":"Acme (Greenhouse)","type":"ats","platform":"greenhouse","url":"https://boards.greenhouse.io/acmecorp","atsType":"greenhouse","trustLevel":70}'

# List with filters
curl "http://localhost:4000/v1/sources?type=ats&isActive=true&search=greenhouse"

# Pause / activate
curl -X PATCH http://localhost:4000/v1/sources/<id>/active \
  -H "content-type: application/json" -d '{"isActive":false}'

# Delete
curl -X DELETE http://localhost:4000/v1/sources/<id>
```

Successful responses are `{ "data": ... }`; errors are `{ "error": { "message": "..." } }`. `url` is
unique — creating a second source with the same URL returns a `400`.

## Validation rules

- `name` must be a non-empty string.
- `type` must be one of the source types above.
- `url` must be a valid `http(s)` URL.
- `platform` must be one of the platforms above (or `null`).
- `trustLevel` must be an integer between 0 and 100.
- `fetchIntervalMinutes` must be an integer between 5 and 1440.
- `limit` must be between 1 and 200; `offset` must be >= 0.

Validation lives in `packages/shared/src/sources.ts` and is enforced by both the API and the
repository before any write.

## Seed script

```bash
pnpm db:seed:sources
```

Inserts five starter sources (three ATS examples, one RSS feed, one manual submissions entry). It is
idempotent: sources whose URL already exists are skipped. Without `DATABASE_URL` it prints a clear
message and exits with code 1. It never runs automatically.
