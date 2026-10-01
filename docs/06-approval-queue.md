# Approval Queue

Phase 6 adds the human review layer between generated drafts and publishing. Drafts are approved,
rejected, or sent back for edits; nothing is published yet.

## generated_posts draft lifecycle

Generated drafts start as `draft` and move through the approval workflow:

- `draft`: waiting for review, editable, and visible in the approval queue.
- `approved`: a human approved the draft; it is eligible for a future publishing phase.
- `rejected`: a human rejected the draft; it stays in the database as history.
- `published`: reserved for the future publishing phase; never set in Phase 6.
- `failed`: reserved for failed publish attempts; never set in Phase 6.

A `needs_edit` decision keeps the draft in `draft` status with the (possibly edited) text, so it
remains in the queue for another review pass.

## Approval decisions

| Decision     | generated_posts.status | text_content                          | approvals row |
| ------------ | ---------------------- | ------------------------------------- | ------------- |
| `approved`   | `approved`             | updated if `textContent` was provided | inserted      |
| `rejected`   | `rejected`             | updated if `textContent` was provided | inserted      |
| `needs_edit` | stays `draft`          | updated if `textContent` was provided | inserted      |

Rules enforced in both the API and the repository:

- `textContent`, when provided, must be a non-empty string.
- A generated post with empty text can never be approved; the API returns
  `Cannot approve a generated post with empty text`.
- Every status or text change bumps `generated_posts.updated_at`.
- The status/text update and the approval insert happen inside a single database transaction, so an
  approval row never exists without its matching status.

## Why approval happens before publishing

Drafts contain AI-extracted or template-generated copy about real companies and real jobs. A wrong
company name, a broken apply link, or an off-tone caption is cheap to fix before posting and
expensive to fix after. Approval also creates the audit trail needed for a public-facing feed:
who decided what, when, and why. Because of that, publishing stays a separate phase that only reads
`approved` rows.

## How the approvals table is used

Every decision inserts one row into `approvals` with:

- `job_post_id`: the job the decision belongs to;
- `decision`: `approved`, `rejected`, or `needs_edit`;
- `notes`: optional reviewer note;
- `decided_by`: optional reviewer identity (free text until authentication exists);
- `decided_at`: decision timestamp.

The table is append-only, so a draft that is rejected and later approved keeps both decisions as
history.

## API endpoints

| Method | Path                               | Description                                                                |
| ------ | ---------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/v1/approval-queue`               | List drafts (`platform`, `status`, `limit`, `offset`); defaults to `draft` |
| GET    | `/v1/generated-posts/:id`          | Fetch one generated post                                                   |
| PATCH  | `/v1/generated-posts/:id/text`     | Edit draft text without changing its status                                |
| POST   | `/v1/generated-posts/:id/approval` | Record an approval decision                                                |

Examples:

```bash
# List drafts waiting for review
curl "http://localhost:4000/v1/approval-queue?platform=x&limit=20"

# Edit a draft before deciding
curl -X PATCH http://localhost:4000/v1/generated-posts/<id>/text \
  -H "content-type: application/json" \
  -d '{"textContent":"Updated draft copy"}'

# Approve
curl -X POST http://localhost:4000/v1/generated-posts/<id>/approval \
  -H "content-type: application/json" \
  -d '{"decision":"approved","notes":"looks good","decidedBy":"admin"}'

# Reject
curl -X POST http://localhost:4000/v1/generated-posts/<id>/approval \
  -H "content-type: application/json" \
  -d '{"decision":"rejected","notes":"wrong location"}'

# Send back for edits with new text
curl -X POST http://localhost:4000/v1/generated-posts/<id>/approval \
  -H "content-type: application/json" \
  -d '{"decision":"needs_edit","textContent":"Shorter version","decidedBy":"admin"}'
```

Responses are `{ "data": ... }` for success and `{ "error": { "message": "..." } }` for failures.
Invalid UUIDs and validation problems return `400`, missing generated posts return `404`, and a
missing `DATABASE_URL` returns a clear JSON `500`.

## Dashboard

The `/approval-queue` page in `apps/web` lists drafts waiting for review with the platform, company
and role, score, status, text preview, and quick links to Generated Posts, Job Posts, and Sources.
It is read-only in this phase; approve, reject, and edit actions are done through the API until
authenticated dashboard actions are built.

## Non-goals for this phase

- No publishing to Telegram, X, Instagram, or LinkedIn.
- No authentication or reviewer accounts; `decidedBy` is free text.
- No scheduling or cron; review happens through manual API calls or the read-only dashboard.
- No image generation or approval of images.
