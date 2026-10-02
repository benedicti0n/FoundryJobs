# Simple Admin Auth

Phase 14 protects the dashboard and risky API endpoints with a single shared admin credential. This
is MVP auth for a private operator tool, not full user authentication.

## What is protected

Dashboard routes (all require a signed admin session, otherwise the request is redirected to
`/login?next=<path>`):

- `/`
- `/sources`
- `/raw-posts`
- `/job-posts`
- `/generated-posts`
- `/approval-queue`
- `/publish-events`
- `/scheduler`

API mutation endpoints (all require the `X-Admin-Token` header):

- `POST /v1/sources`
- `PATCH /v1/sources/:id`
- `PATCH /v1/sources/:id/active`
- `DELETE /v1/sources/:id`
- `POST /v1/sources/:id/fetch`
- `POST /v1/raw-posts/:id/normalize`
- `POST /v1/job-posts/:id/generate-posts`
- `PATCH /v1/generated-posts/:id/text`
- `POST /v1/generated-posts/:id/approval`
- `POST /v1/generated-posts/:id/publish/telegram`
- `POST /v1/generated-posts/:id/render/instagram-card`
- `POST /v1/generated-posts/:id/upload/instagram-card`
- `POST /v1/generated-posts/:id/publish/buffer`

Remaining public endpoints: `GET /health`, `GET /v1/status`, `GET /v1/db/status`, and the read-only
dashboard data endpoints (`GET /v1/sources`, `GET /v1/raw-posts`, `GET /v1/job-posts`,
`GET /v1/generated-posts`, `GET /v1/generated-posts/:id`, `GET /v1/approval-queue`,
`GET /v1/publish-events`, `GET /v1/scheduler/status`). Read-only data stays public for now so
monitoring and diagnostics keep working without credentials.

## Dashboard auth environment variables

| Variable               | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `ADMIN_USERNAME`       | Single admin username.                                   |
| `ADMIN_PASSWORD`       | Single admin password.                                   |
| `ADMIN_SESSION_SECRET` | Secret used to sign the session cookie with HMAC-SHA256. |

If any of the three are missing, protected pages render a clear setup error instead of content:
`Admin auth is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET.`

## Session cookie

Login sets a cookie named `foundryjobs_admin_session` with:

- an HMAC-SHA256 signed payload of `{ username, iat }` (no password, ever);
- `HttpOnly` so JavaScript cannot read it;
- `SameSite=Lax` so cross-site POSTs do not carry it;
- `Secure` in production builds;
- a 7-day `Max-Age`, after which the signature is rejected by the age check.

The web app never imports auth code at module scope without environment access; missing variables
produce the setup error at request time rather than a crash at boot.

## Login and logout behavior

- `/login` is public and redirects to `/` when a valid session already exists.
- A wrong username or password redirects back to `/login?error=Invalid%20username%20or%20password`.
- A correct login redirects to the sanitized `next` path when present (only same-site paths are
  accepted; `/login`, `//`-prefixed, and non-path values are ignored) or to `/` otherwise.
- The `Log out` button in the dashboard header calls a server action that deletes the cookie and
  redirects to `/login`.
- Every protected request first passes middleware (redirect with `next` when the cookie is absent)
  and then the dashboard layout verifies the cookie signature.

## API admin token

`API_ADMIN_TOKEN` protects mutation endpoints through the `X-Admin-Token` request header, compared
with `crypto.timingSafeEqual` so the check does not leak the expected value through timing:

- if `API_ADMIN_TOKEN` is not configured, mutations return HTTP 500
  `API admin token is not configured. Set API_ADMIN_TOKEN.`;
- if the header is missing or wrong, mutations return HTTP 401 `Unauthorized`;
- read-only endpoints are unaffected.

Worker commands and the scheduler call the pipeline packages directly and never go through the API,
so they do not need the token and are unaffected by this phase.

## How the dashboard talks to the API

Web server actions run on the web server and call the API server-side through
`apps/web/src/lib/api.ts`, which attaches `X-Admin-Token: process.env.API_ADMIN_TOKEN` to every
mutation request. The token never reaches the browser. If `API_ADMIN_TOKEN` is missing on the web
side, actions fail fast with `API admin token is not configured. Set API_ADMIN_TOKEN.` instead of
sending an unprotected request.

## Limitations

- Single shared admin account with no user accounts, roles, or audit identity beyond `dashboard`.
- No OAuth, no Better Auth, no signup, no password reset, no user tables.
- No session revocation list; rotating `ADMIN_SESSION_SECRET` invalidates all sessions at once.
- No rate limiting or lockout on the login form.
- Not intended as public multi-user authentication; keep the dashboard and API on a trusted network
  until a real identity provider is added.
