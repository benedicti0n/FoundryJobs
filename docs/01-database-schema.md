# Database Schema

FoundryJobs stores its data in PostgreSQL and accesses it through Drizzle ORM from `packages/db`.

- Schema source: `packages/db/src/schema`
- Migrations: `packages/db/drizzle` (first migration: `0000_init.sql`)
- Config: `packages/db/drizzle.config.ts` (reads `DATABASE_URL`; generation works offline)
- Client helper: `getDatabase()` / `createDatabase()` in `packages/db/src/client.ts`

All timestamps are stored as `timestamp with time zone`. The union types that describe the
enum-like `text` columns live in `packages/shared/src/types.ts`; the database keeps those columns
as `text` so new values can be introduced without a migration, and validation happens in app code.

## Tables

### `sources`

Registered places to fetch hiring posts from: ATS boards, company career pages, RSS feeds, web
pages, Telegram channels, X searches, and manual entries. Stores type, platform, URL, trust level,
fetch interval, active flag, and last fetch time. `url` is unique so the same feed cannot be
registered twice.

### `raw_posts`

Raw fetched content exactly as it came from a source, before any normalization. `content_hash` is
unique and is used for deduplication. `status` tracks the pipeline position of the row:
`new` → `duplicate` / `normalized` / `rejected` / `error`.

### `job_posts`

The normalized hiring-post entity: company, role, location, work mode, employment type, experience
range, qualification, batch years, skills, salary, apply links, posted/expiry dates. `status`
tracks the editorial lifecycle: `draft` → `scored` → `queued` → `approved` → `published`, with
`rejected` and `expired` as terminal states. `raw_post_id` links back to the raw fetch for
provenance and is set to `NULL` if the raw row is deleted.

### `job_scores`

The scoring result for a job: freshness, fresher fit, tech relevance, trust, remote bonus, clarity,
and total scores, plus spam risk, a `should_post` flag, and the AI reason/model when an AI provider
was used. Kept in its own table so a job can be re-scored over time without touching the job row.

### `generated_posts`

Platform-specific drafts generated from a job: the target platform, format (`single_job`), the text
content, an optional image URL, and review status (`draft` / `approved` / `rejected` / `published` /
`failed`). One job can have many generated posts — one per platform or format.

### `approvals`

Human review decisions on a job: `approved`, `rejected`, or `needs_edit`, with optional notes and
the reviewer identity. Append-only so the decision history stays intact.

### `publish_events`

A record of each actual publish attempt: target platform, external post id, published URL, status
(`pending` / `success` / `failed`), error message, and timestamps.

### `companies`

Company metadata and trust data: name, website, domain, logo, and trust level. `domain` is unique
but nullable, so companies without a known domain are allowed. Used to enrich and score jobs
consistently across sources.

### `blacklist_rules`

Rules that block spammy content: domains, emails, keywords, source URLs, or companies. `(type, value)`
is unique so the same rule cannot be added twice; `is_active` allows retiring a rule without
deleting it.

### `prompt_runs`

One row per AI provider call: the task (`extract_job`, `score_job`, `generate_posts`,
`generate_image_prompt`), provider, model, input/output tokens, computed cost, and latency.

## Design decisions

### Why `raw_posts` and `job_posts` are separate

Fetching and understanding are different stages with different lifecycles. `raw_posts` is the
immutable evidence of what a source actually returned; `job_posts` is the mutable, structured
entity that the rest of the pipeline works with. Keeping them apart means:

- normalization/parsing can be re-run over stored raw content when extractors improve, without
  re-fetching anything;
- a bug in normalization never destroys the original data;
- deduplication can happen on raw content hashes before any parsing work is done.

### Why `generated_posts` is separate from `publish_events`

Generation and publishing have different failure modes and timelines. A generated post is content
that can be edited, regenerated, or rejected; a publish event is a side effect that already happened
(or failed) on an external platform. Separating them means:

- one generated post can have multiple publish attempts (retries, re-posts) with a full audit trail;
- editing or regenerating content does not rewrite publishing history;
- publish failures are recorded without mutating the reviewed content.

### Why `prompt_runs` exists

AI calls cost money and can fail or degrade silently. Recording every call — task, provider, model,
token counts, computed cost, and latency — gives cost visibility per feature, lets us debug bad
outputs after the fact, and supports budget limits before usage gets out of hand. It is kept
separate from `job_scores` so that scores remain the product output while `prompt_runs` stays
operational telemetry; `job_post_id` is nullable and set to `NULL` on delete so cost history
survives job cleanup.

## Mapping to shared types

| Shared type             | Column                      |
| ----------------------- | --------------------------- |
| `SourceType`            | `sources.type`              |
| `SourcePlatform`        | `sources.platform`          |
| `JobStatus`             | `job_posts.status`          |
| `GeneratedPostPlatform` | `generated_posts.platform`  |
| `GeneratedPostStatus`   | `generated_posts.status`    |
| `SpamRisk`              | `job_scores.spam_risk`      |
| `ApprovalDecision`      | `approvals.decision`        |
| `WorkMode`              | `job_posts.work_mode`       |
| `EmploymentType`        | `job_posts.employment_type` |

## Commands

```bash
pnpm db:generate  # diff schema against snapshots and write a new SQL migration
pnpm db:migrate   # apply pending migrations (requires DATABASE_URL)
pnpm db:studio    # inspect data in Drizzle Studio (requires DATABASE_URL)
```

`pnpm db:generate` works without a database connection. `db:migrate` and `db:studio` require a
`DATABASE_URL`; when it is missing they fail instead of guessing a target database.
