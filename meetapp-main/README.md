# Meeting Coach MVP

Fast local-first MVP for capturing meeting audio (browser screen/tab), transcription, and AI coaching feedback.

## Features (current)

- **Home → Capture**: expandable capture menu (record, schedule, invite shortcuts; links to uploads and Google Meet).
- **Meetings**: grouped list, Google Calendar read-only panel (events + Meet links), **Voice agent** tab (speech recognition + `/api/coach/ask` against a chosen transcript).
- **Settings**: recording/transcript toggles, **Slack webhook URL** (or `SLACK_WEBHOOK_URL` env), **recording / restriction keyword rules** applied in `/api/analyze`, **workspace API key** rotate, Google Calendar OAuth connect.
- **Auth**: email/password accounts stored in `data/app-db.json` with **bcrypt** hashes; **JWT** `Bearer` tokens in `sessionStorage` (see `/login.html`, `/signup.html`, Google Sign-In when `GOOGLE_CLIENT_ID` is set).
- **Notifications** (home bell): dismissals stored **on the server** in the JSON DB (`notificationDismissals`).
- **Integrations**: Slack post when `coachStatus` becomes `completed`; email via SMTP for invites and optional recap/prep (see env below).

## Limits (by design)

- **No Google Meet bot**: Calendar integration does not auto-join or record calls; it only lists events and Meet links.
- **Single JSON file DB** (`data/app-db.json`, gitignored): fine for one machine; not a replacement for Postgres + real multi-tenant isolation.
- **`REQUIRE_AUTH=false` by default**: dashboard APIs are open unless you set `REQUIRE_AUTH=true` and send `Authorization: Bearer <jwt>`.

## Install & run

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` (or the port in `.env`).

## Environment

See `.env.example` for:

- `OPENAI_API_KEY` — real transcription + analysis; omit for mock mode.
- `JWT_SECRET` — **required when `NODE_ENV=production`**.
- `REQUIRE_AUTH`, `APP_BASE_URL`, rate limit knobs.
- Google OAuth (Sign-In + Calendar): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI.
- `SLACK_WEBHOOK_URL` or save a webhook in Settings.
- SMTP for outbound mail (`SMTP_HOST`, …, `RECAP_EMAIL_TO`).

## Docker

The image listens on **`PORT` (default `8080` in the Dockerfile)**.

```bash
docker build -t meetingly .
docker run --rm -p 8080:8080 \
  -e OPENAI_API_KEY=... \
  -e JWT_SECRET=... \
  -e NODE_ENV=production \
  meetingly
```

Mount a volume for `/app/data` if you need persistence across container restarts.

## Production checklist

- HTTPS terminator (reverse proxy or PaaS).
- Strong `JWT_SECRET`, never commit `.env`.
- Set `REQUIRE_AUTH=true` once all clients send the JWT.
- Tune `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX`.
- Prefer a real database and mail provider for SaaS-style deployments.
- Add centralized error tracking (e.g. Sentry) if you need production observability beyond JSON logs on stdout.

## Tests & CI

```bash
npm test
```

GitHub Actions workflow: `.github/workflows/ci.yml`.

## Notes

- Browser tab/system audio capture depends on OS + browser policy.
- Capture legal consent and retention rules before real user data.
