# Source Expansion — Audit, Discovery, and Production Catalog

This document records the Phase 1 audit, the live validation research behind the expanded source
catalog, and the enterprise ATS discovery findings. All live checks were read-only.

## 1. Existing architecture (audit)

- **Schema** (`packages/db/src/schema/sources.ts`): `name`, `type`, `platform`, `url` (unique),
  `ats_type`, `trust_level`, `fetch_interval_minutes`, `is_active`, `last_fetched_at`. No category
  metadata existed. Migration `0002` adds `category`, `region`, `priority`.
- **Adapters** (`packages/fetchers`): `SourceFetcher { platform, fetch(source) }` with Greenhouse,
  Lever, and Ashby implementations plus a registry. `run.ts` isolates per-source failures (a broken
  source returns `failed` and the cycle continues), inserts raw posts with content-hash dedupe, and
  updates `last_fetched_at`.
- **Seed** (`packages/db/src/seed/sources.ts`): five placeholder sources (Acme/Example/Manual),
  `onConflictDoNothing` by URL. Kept as dev fixtures, now explicitly inactive.
- **Protected source API** (`apps/api/src/routes/sources.ts`) with shared validation in
  `packages/shared/src/sources.ts`.
- **Dedupe**: `raw_posts.content_hash` unique index + `onConflictDoNothing`. Cross-source URL
  duplicates were not checked. `job_posts` fingerprint dedupe exists post-normalization.
- **Tests**: scheduler/approval/publisher/auth suites (62 tests) plus a dedicated test database;
  no fetcher adapter tests existed before this phase.
- **Databases**: local `foundryjobs_dev` had 4 real sources (Figma, Clerk, Discord, Lever Demo);
  Neon had 0 sources. Lever Demo and the Acme/Example placeholders must not be production sources.

## 2. Taxonomy

`category` (`big_tech | startup | yc | remote | mass_hiring | general`), `region`
(`india | global | remote | mixed`), `priority` (`high | normal | low`) are now first-class columns,
validated in shared types, persisted by the source repository, and exposed through the API.
Category is source-level context for future diversification; it is not a substitute for job-level
scoring.

## 3. Production catalog (`packages/db/src/sources/manifest.ts`)

| Category    | Active sources |
| ----------- | -------------- |
| Big Tech    | 18             |
| Startup     | 10             |
| YC          | 19             |
| Remote      | 4              |
| Mass Hiring | 8              |
| General     | 0              |
| **Total**   | **59**         |

Every source was validated against its live public endpoint before inclusion. Highlights:

- Big tech: Cloudflare, Datadog, Stripe, Reddit, Dropbox, Coinbase, Airbnb, Pinterest, Twilio,
  Roblox, MongoDB, Elastic, Databricks, Discord, Figma, OpenAI (Ashby), NVIDIA and Salesforce
  (Workday).
- India: Groww (Greenhouse, YC), Zeta and CRED (Lever).
- Remote: GitLab, Canonical, Himalayas RSS, We Work Remotely RSS.
- Mass hiring: Bosch Group and Endava (SmartRecruiters), PwC, HP, Micron, Intel, Visa, Cisco
  (Workday).

## 4. Rejected candidates (validated as unavailable)

- **Greenhouse 404 (not on this ATS):** HashiCorp, Notion, DoorDash, Snowflake, Confluent,
  Benchling, Grammarly, Canva, Zapier, Amplitude, Sentry, Retool, Anduril, Help Scout, Oyster,
  Automattic, Razorpay, Freshworks, Chargebee, Dream11, Postman, BrowserStack, Hasura, MoEngage,
  Whatfix, Tekion, Innovaccer, Meesho, Zomato, Swiggy, Flipkart (many use proprietary portals).
- **Ashby 404:** Metabase, Dagster Labs, Pydantic, Cal.com, Whatnot, Clipboard Health, Jupiter,
  Setu, Fi, Zepto, Khatabook, Locus, Netcore, Yellow.ai, Haptik.
- **Lever 404:** Wingify, Doist, Close, Razorpay, Hotjar, Buffer. (`leverdemo` is a demo and was
  deactivated.)
- **Empty boards (0 jobs):** Mercury, Deel (Ashby), Remote.com (Greenhouse), plus dozens of
  SmartRecruiters tenant guesses.
- **General feeds blocked:** `startup.jobs` (403 Cloudflare), `remotefirstjobs.com` (403),
  `remoteyeah.com` (404) — no stable public feed; not implemented.

## 5. General feeds implemented

- **Himalayas** `https://himalayas.app/jobs/rss` (20 items per fetch, Atom/RSS parser).
- **We Work Remotely — Programming** `https://weworkremotely.com/categories/remote-programming-jobs.rss`
  (25 items). The new RSS adapter supports RSS and Atom, strips HTML, dedupes by GUID/link, caps at
  50 items, and returns an empty list for malformed feeds instead of throwing.
- Validated but not implemented this phase: RemoteOK public API (100 jobs) and Remotive API.

## 6. YC strategy

`ycombinator.com/jobs` and `workatastartup.com` expose no stable public structured endpoint
(`/jobs.json`, `/api/jobs` → 404/406; the WaaS page is a client-rendered Remix app). Per the
preference order, the chosen strategy is a **curated YC ATS watchlist**: 19 companies confirmed via
their public `ycombinator.com/companies/<slug>` pages (Airbnb, Ashby, Brex, Checkr, Coinbase,
Dropbox, Faire, Groww, Gusto, Instacart, Mixpanel, Modal, PagerDuty, PostHog, Ramp, Reddit, Replit,
Resend, Scale AI, Stripe, Supabase, Vanta, Warp, Webflow) and fetched through their Greenhouse or
Ashby boards with `category = yc`. No scraping was implemented.

## 7. Enterprise ATS discovery

| ATS family                    | Public structured endpoint                                                                                                              | Result                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Workday**                   | `POST https://{tenant}.{wdN}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` (JSON, paginated) and `GET .../{externalPath}` for detail | **Implemented** (adapter). 8 validated employers: PwC, NVIDIA, Salesforce, HP, Micron, Intel, Visa, Cisco |
| **SmartRecruiters**           | `GET https://api.smartrecruiters.com/v1/companies/{company}/postings` + `/postings/{id}` (documented public API)                        | **Implemented** (adapter). 2 validated employers: Bosch Group (4,844 postings), Endava                    |
| **SAP SuccessFactors**        | Career-site JSON varies per tenant (RCM endpoints, CSB); no consistent public contract                                                  | **Not implemented** — per-tenant discovery required                                                       |
| **Oracle Recruiting / Taleo** | Oracle CE uses `/hcmRestApi/...recruitingCEJobRequisitions` with per-pod hosts; Taleo uses legacy careersection endpoints               | **Not implemented** — per-tenant discovery required                                                       |

Mass-hiring employers investigated but unsupported (no public structured endpoint found or wrong
tenant/site): Accenture, Cognizant, Capgemini, Infosys, TCS, Wipro, HCLTech, Tech Mahindra, Genpact,
LTIMindtree, NTT DATA, DXC, CGI, Hexaware, Mphasis, Persistent, Coforge, Virtusa, Birlasoft, UST,
Zensar, Sopra Steria, Deloitte, EY, KPMG. Most use proprietary portals (TCS NextStep, Infosys,
Wipro, etc.); no endpoints were guessed or scraped.

## 8. Fetch safety

- Request timeouts (15s default) and sanitized HTTP errors (`fetchJson`/`fetchText`).
- Caps per fetch: Greenhouse 300, Ashby 250, Lever 250, Workday 100 (5 pages, 20 details), SmartRecruiters 100 (2 pages, 20 details), RSS 50.
- Per-source failure isolation in `run.ts`; no retries beyond bounded detail fetches; user agent
  `FoundryJobsBot/0.1`; no infinite pagination.

## 9. Dedupe changes

`createRawPostIfNotExists` now also rejects a raw post whose canonical `raw_url` already exists
(any source), in addition to the content-hash unique index. This catches the same job URL arriving
from two sources (e.g., a direct ATS board and an aggregator pointing at the same posting). Job-level
fingerprint dedupe in normalization remains the second safety net; no aggressive title-based merging
was added.

## 10. Production sync (`pnpm sources:sync`)

- `pnpm sources:sync --env=dev|test|production [--dry-run] [--yes]`
- Idempotent upsert by canonical URL; reports `added / updated / unchanged / deactivated`.
- Never deletes rows and never touches job data; deactivates only active sources missing from the
  manifest.
- `--env` is required; production refuses localhost targets and requires `--yes` for real runs.
- Dry run: `pnpm sources:sync --env=production --dry-run` (after applying migration `0002` to Neon).

## 11. Live verification (`LIVE_INTEGRATION_TESTS=true pnpm sources:verify`)

Guarded, read-only, fetch-only: no publishing, no Telegram/Buffer/SuperProfile calls, no database
writes. Optional `--filter=` and `--category=` arguments. Latest run: **59 sources verified, 59 ok,
0 empty, 6,785 jobs**, sample job URL checks mostly HTTP 200 (a few ATS job pages return 403 to bot
user agents; the APIs themselves work).

## 12. Pending

- Apply migration `0002` to Neon and run the production source sync (dry-run first, then `--yes`).
- SuccessFactors and Oracle/Taleo adapters need per-tenant discovery before implementation.
- RemoteOK/Remotive APIs are validated but not yet implemented.
