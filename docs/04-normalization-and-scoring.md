# Normalization and Scoring

Phase 4 turns raw fetched posts into structured, scored job posts. It is the bridge between the
fetching pipeline (`docs/03-fetching-pipeline.md`) and future social post generation.

## Pipeline overview

`normalize:once` (or `POST /v1/raw-posts/:id/normalize` for a single post) processes `raw_posts`
rows with status `new`, oldest first, default limit 25 and `NORMALIZE_LIMIT` to override it:

1. The raw post is loaded from `raw_posts`.
2. The extractor (`packages/ai`) produces an `ExtractedJobData` object.
3. A fingerprint check (`roleTitle` + `companyName` + `location` + `applyUrl`/`applyEmail` where
   available) looks for an existing `job_posts` row.
4. If no duplicate exists, the scoring engine (`packages/scoring`) computes a `JobScoreBreakdown`,
   then a `job_posts` row (status `scored`) and a `job_scores` row are inserted.
5. The raw post is marked `normalized`, `rejected`, or `error` with the reason in `error_message`.

A rejected extraction (non-hiring, non-tech, more than 3 years of experience) marks the raw post
`rejected`. A failed extraction (provider error, invalid JSON) marks it `error`. A fingerprint
duplicate is marked `normalized` and reuses the existing job post id.

One bad post never stops a run: `normalize:once` catches per-post errors and continues.

## Gemini extraction

When `GEMINI_API_KEY` is present, extraction goes through the Gemini REST API:

- the model is configurable through `GEMINI_MODEL` and defaults to `gemini-2.5-flash-lite`;
- the prompt (`packages/ai/src/prompts/job-extraction.ts`) describes the FoundryJobs target
  audience and returns strict JSON only, with no markdown fences;
- the model is instructed to reject non-hiring posts, non-tech roles, and roles above 3 years of
  experience, and to never invent missing details;
- responses are parsed defensively: markdown fences are stripped, required fields are validated,
  enum values fall back to `unknown`, and invalid JSON becomes an `error` result;
- token usage and latency are recorded in `prompt_runs` with `task = "extract_job"` and
  `provider = "gemini"`; a failed `prompt_runs` insert never blocks normalization.

## Rules fallback

When `GEMINI_API_KEY` is missing, a deterministic rule extractor
(`packages/ai/src/rule-extractor.ts`) runs instead, so local development and tests work with no API
key. It:

- parses the labeled lines our fetchers write (`Title:`, `Company:`, `Location:`,
  `Departments:`, `Employment type:`, `Categories:`);
- detects emails and URLs, preferring apply-like URLs;
- detects work mode (`remote`, `hybrid`, `onsite`, `unknown`), including `remote or in-office`
  style wording;
- detects employment type (`internship`, `full_time`, `part_time`, `contract`);
- detects batch years (`2024`–`2035`), skills from `COMMON_SKILLS`, salary strings, and
  qualifications;
- detects experience ranges (`0-1`, `0–2`, `1 to 3`, `3+`, `minimum 2`);
- rejects non-tech roles and roles requiring more than 3 years unless fresher or intern wording is
  present.

It is intentionally simple and deterministic; it is not meant to match Gemini quality.

## Scoring components

`packages/scoring/src/score-job.ts` computes six components that sum to 100:

| Component            | Max | Rules                                                                                                                 |
| -------------------- | --- | --------------------------------------------------------------------------------------------------------------------- |
| `freshnessScore`     | 20  | ≤7d: 20, ≤14d: 16, ≤30d: 12, ≤60d: 8, ≤90d: 4, older: 0, missing: 8.                                                  |
| `fresherFitScore`    | 25  | internship: 25; max exp 0: 25, 1: 22, 2: 18, 3: 14, >3: 0; null: 10; +5 with batch years.                             |
| `techRelevanceScore` | 20  | +3 per detected skill (cap 15), +5 when the title matches tech keywords.                                              |
| `trustScore`         | 20  | base 10; +6 for ATS sources, +2 for generic; +2 company, +2 apply link/email; source trust weighting; spam penalties. |
| `remoteBonus`        | 10  | remote: 10, hybrid: 6, remote-after-training wording: 5, onsite: 0, unknown: 2.                                       |
| `clarityScore`       | 5   | +2 clear title, +1 company, +1 apply link/email, +1 skills (capped).                                                  |

Spam keywords from `SPAM_KEYWORDS` set `spamRisk` to `medium` (one match) or `high` (two or more)
and reduce `trustScore`.

## shouldPost logic

`shouldPost` is true only when **all** of the following hold:

- `totalScore >= 70`;
- `isHiringPost` is true;
- `isTechRole` is true;
- `spamRisk` is not `high`;
- `experienceMax` is null or ≤ 3 (and `experienceMin` is null or ≤ 3).

Job posts are created for every extracted hiring post, even when `shouldPost` is false; the score
row records why.

## Why social post generation is separate

Extraction and scoring answer "is this a good job to post?", while generation answers "how should
this look on Telegram, X, Instagram, and LinkedIn?". Keeping them separate means:

- scoring is deterministic, cheap, and explainable, and can gate AI copy generation;
- generation can be re-run with better prompts without re-extracting or re-scoring;
- approval sits between scoring and publishing, so nothing reaches a platform without review.

## Running normalization

```bash
# Normalize the next 25 new raw posts
pnpm --filter @foundryjobs/worker normalize:once

# Override the batch size (1-200)
NORMALIZE_LIMIT=100 pnpm --filter @foundryjobs/worker normalize:once

# Normalize one specific raw post
curl -X POST http://localhost:4000/v1/raw-posts/<raw-post-id>/normalize
```

A run prints the configured extraction provider, per-post statuses, job post ids, scores, and the
`shouldPost` verdict. Already-normalized raw posts are skipped because only `new` rows are
processed; normalizing a non-`new` raw post through the API returns a `400`.
