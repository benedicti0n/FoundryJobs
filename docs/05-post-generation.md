# Post Generation

Phase 5 turns scored job posts into platform-specific draft posts for Telegram, X, Instagram, and
LinkedIn. It stops at drafts: nothing is approved or published yet.

## From job_posts and job_scores to generated_posts

`generate-posts:once` (or `POST /v1/job-posts/:id/generate-posts` for a single job) works like this:

1. It selects job posts that have status `scored`, whose latest `job_scores` row has
   `should_post = true`, and that have no `generated_posts` rows yet.
2. For each job it builds four deterministic drafts: Telegram, X, Instagram, and LinkedIn.
3. The drafts are inserted into `generated_posts` as four rows with `format_type = "single_job"`,
   `status = "draft"`, and `image_url = null`.
4. Jobs that already have generated posts are skipped, so re-running the worker never duplicates
   drafts for the same job.

A manual API call on a job that is not flagged for posting returns `status: "skipped"` with the
reason and the job's total score.

## Why deterministic templates are used first

- Templates are free, instant, and fully deterministic, so the pipeline works with no API keys and
  the same job always produces the same draft.
- They cannot hallucinate salary, deadlines, or benefits because they only format fields that were
  already extracted and stored.
- AI polish (for example with `OPENAI_API_KEY`) can be layered on later without changing the
  pipeline contract, because the templates already define the structure and the platform limits.
- Reproducible drafts make review and diffing possible before approval.

OpenAI polishing is intentionally not implemented in this phase; the deterministic templates are
the default and the only active generator.

## Platform formatting rules

All drafts share a set of formatting rules:

- `companyName` missing becomes `Company not specified`, and `location` missing becomes
  `Location not specified`; work mode `unknown` becomes `Not specified`.
- Skills lines are omitted entirely when the skills list is empty.
- Experience is formatted from the structured fields: `0–2 YOE` style ranges, `Freshers / 0–2 YOE`
  when the minimum is zero, `Internship / ...` for internships, `N YOE+` for minimum-only roles,
  `Up to N YOE` for maximum-only roles, and `Freshers eligible` when no numbers exist but the title
  or batch years indicate a fresher role.
- Apply information prefers `applyUrl`, then `applyEmail`, and falls back to
  `Apply link not available in source`; salary and deadlines are never invented.

Platform specifics:

- **Telegram** (limit 4096): the richest format, with company, role, eligibility when known,
  experience, location, work mode, skills, a relevance line, the apply target, a verification note,
  and the FoundryJobs CTA.
- **X** (limit 280): a compact format with company, role, experience, location, up to four skills,
  the apply target, and `Follow @FoundryJobs`. The generator tries progressively shorter variants
  until one fits in 280 characters, and only if a very long URL makes that impossible does it fall
  back to a hard 320-character cap.
- **Instagram** (limit 2200): a caption with role, company, experience, location, skills separated
  by bullets, an apply sentence, a save-and-share line, and the CTA.
- **LinkedIn** (limit 3000): a professional format with a key-skills list, a relevance line, the
  apply target, a verification note, and hashtags that include a role-category tag such as
  `#DataJobs` or `#SoftwareJobs`.

## Why publishing is separate

Generation produces content; publishing performs irreversible side effects on external platforms.
Keeping them apart means drafts can be reviewed, edited, regenerated, and rejected without touching
any platform API, and publishing can add retries, rate limits, and an audit trail in
`publish_events` without changing how content is created. No Telegram, X, Instagram, or LinkedIn
API is called anywhere in this phase.

## Running post generation

```bash
# Generate drafts for the next 25 ready jobs
pnpm --filter @foundryjobs/worker generate-posts:once

# Override the batch size (1-200)
GENERATE_POSTS_LIMIT=100 pnpm --filter @foundryjobs/worker generate-posts:once

# Generate drafts for one specific job post
curl -X POST http://localhost:4000/v1/job-posts/<job-post-id>/generate-posts
```

A run prints the processed count and per-job results with generated counts, skip reasons, or
errors. Because only jobs without generated posts are selected, a second run immediately after a
successful run processes zero jobs; manual API calls on already-generated jobs are skipped with the
reason `Generated posts already exist for this job`.

## X character length

`PLATFORM_CHARACTER_LIMITS.x` is 280. The X generator builds several candidate versions from the
same structured data and picks the shortest one that fits within 280 characters, dropping the skills
line and then the location line as needed. If the apply URL itself is so long that no compact
variant fits, the draft is truncated at 320 characters instead of 280, which is the documented
fallback ceiling. Every other platform is truncated at its own limit as a safety net, though the
templates are well below those limits in practice.
