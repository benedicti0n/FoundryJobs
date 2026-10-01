# Dashboard Approval Actions

Phase 11 makes the `/approval-queue` dashboard page usable without curl: reviewers can edit draft
text and approve, reject, or mark drafts as needing more work directly in the browser. Nothing is
published from this page.

## How the page works

The approval queue page is a server-rendered Next.js page that:

1. fetches `GET /v1/approval-queue` from the API using `API_BASE_URL`;
2. renders every draft as a card with its platform, company, role, score, status, timestamps, text
   preview, optional image link, and an editable textarea;
3. submits actions through Next.js server actions, which run on the web server and call the
   FoundryJobs API server-side, so `API_BASE_URL` never has to be exposed to the browser.

Each card form contains the generated post id, the editable text, and four submit buttons:
`Approve`, `Reject`, `Needs edit`, and `Save text`. Because the forms work without client
JavaScript (progressive enhancement), the same actions also work in script-limited environments.

## Actions and API calls

| Dashboard action | API call                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Save text`      | `PATCH /v1/generated-posts/:id/text` with the textarea value.                                                                                                                        |
| `Approve`        | `POST /v1/generated-posts/:id/approval` with `decision: "approved"`, `decidedBy: "dashboard"`, and `textContent` when the textarea is non-empty.                                     |
| `Reject`         | `POST /v1/generated-posts/:id/approval` with `decision: "rejected"` and `decidedBy: "dashboard"`.                                                                                    |
| `Needs edit`     | `POST /v1/generated-posts/:id/approval` with `decision: "needs_edit"`, `decidedBy: "dashboard"`, `notes: "Marked from dashboard"`, and `textContent` when the textarea is non-empty. |

Rules enforced by the action layer:

- text updates and approvals never send empty `textContent`; a blank `Save text` submission is
  rejected with the flash message `Draft text cannot be empty`;
- `Approve` and `Reject` include the edited text only when the textarea has content, so the API's
  existing validation stays in charge;
- after a successful action the page calls `revalidatePath("/approval-queue")` and redirects back to
  the queue with a success message; failures redirect with the API error message instead.

## Flash messages

Server actions communicate outcomes through redirect query parameters
(`/approval-queue?message=...` or `/approval-queue?error=...`), which the page renders as a green
success notice or an amber error notice. This keeps the whole flow server-side with no client state
to manage, and every action re-renders the queue with fresh data.

## API_BASE_URL requirement

The dashboard needs `API_BASE_URL` pointing at the FoundryJobs API (for example
`http://localhost:4000`). Without it, the page renders the `API not configured` notice and no
action forms, and server actions fail with `API_BASE_URL is not configured` if invoked anyway.

## Known limitation: no authentication

There is still no authentication anywhere in the stack, so anyone who can reach the dashboard can
approve or reject drafts, and `decidedBy` is the hardcoded string `dashboard`. Do not expose the web
app or the API publicly until authentication lands.

## No publishing from approval actions

Approval actions only edit text and change `generated_posts.status`. They never call Telegram,
Buffer, Meta, X, LinkedIn, or Instagram, never render images, and never insert `publish_events`
rows. Publishing remains a separate manual step through the existing worker commands and publish
endpoints.
