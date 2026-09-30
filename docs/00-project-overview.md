# FoundryJobs — Project Overview

## What FoundryJobs is

FoundryJobs is a hiring-post fetcher and social-post generator. It collects fresher, intern, and
0–3 YOE tech hiring posts from trusted internet sources, filters and scores them with AI, and turns
the best ones into platform-specific posts for Telegram, X, Instagram, and LinkedIn. Every post is
reviewed in an approval queue before anything is published.

## Target users

- Freshers looking for their first tech role
- Internship seekers
- Early-career engineers with 0–3 years of experience

## Planned platforms

- Telegram
- X (Twitter)
- Instagram
- LinkedIn (publishing only)

## Planned phases

- **Phase 0 — Bootstrap (current):** monorepo workspace, tooling, app shells, health endpoints,
  shared config, and documentation.
- **Phase 1 — Sources:** define trusted sources, fetch hiring posts, deduplicate, store raw entries.
- **Phase 2 — AI filtering & scoring:** score relevance, freshness, and quality for the target
  audience.
- **Phase 3 — Post generation:** generate platform-specific drafts from scored jobs.
- **Phase 4 — Approval queue:** review, edit, and approve drafts before publishing.
- **Phase 5 — Publishing:** publish approved posts to Telegram, X, Instagram, and LinkedIn.

## Non-goals for the MVP

- No LinkedIn scraping
- No automatic posting without approval initially
- No paid job API dependency initially
