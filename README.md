# Gigaprowl — the smartest job hunter in the world

Agentic job-hunting SaaS. Upload a resume → AI profiles you → daily scanner pulls live jobs from top-company boards → matches are scored → one click ("Hunt this") finds the hiring manager, builds a personalized pitch page + AI avatar video, and runs a multi-step email/LinkedIn cadence. Credit-based plans via Stripe.

Live: https://prowl-livid.vercel.app

## Run it

```bash
npm install
cp .env.example .env    # add keys you have (app degrades to demo mode without them)
npm run dev             # http://localhost:3000
```

## What's real vs. keyed vs. fallback

| Capability | Status |
|---|---|
| Auth (signup / login / reset) | **Real** — cookie sessions (HMAC + scrypt). Email verification routes exist; gate is temporarily disabled (`emailVerified: true` on signup) |
| Resume parsing (PDF/DOCX/TXT) | **Real** — heuristic parser works keyless; `ANTHROPIC_API_KEY` for full AI parsing |
| Job ingestion | **Real, keyless** — Remotive + Greenhouse / Lever / Ashby (+ more) top-company boards; `ADZUNA_APP_*` adds an aggregator. Seeds demo jobs if offline |
| Matching | **Real** — skills, seniority, product/services fit, ranked scores (`lib/match.js`) |
| Hiring-manager discovery | Keyed — `APOLLO_API_KEY` (+ optional `LEADMAGIC_API_KEY`); demo contacts otherwise |
| Pitch pages + cadences | **Real** — AI-generated with key, templates without. Live at `/p/<slug>` |
| Avatar video | Keyed — face/voice upload → HeyGen clone/render (`HEYGEN_API_KEY`; optional `ELEVENLABS_API_KEY`) |
| Email send | Keyed — Resend and/or Gmail OAuth send-as / drafts (`RESEND_API_KEY`, `GOOGLE_CLIENT_*`) |
| LinkedIn send | **Real** — Chrome extension (`extension/`) queues invites/DMs from the user's browser session; optional Unipile managed path (`UNIPILE_*`) |
| Payments | Keyed — Stripe Checkout + webhook (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) |
| Persistence | Upstash Redis / Vercel KV in prod (`KV_REST_API_*`); local JSON under `data/` in dev |

## Daily jobs

Vercel Cron (`vercel.json`):

- `GET/POST /api/jobs/sync` — `0 6 * * *` top-company job scan
- `/api/cron/scheduler` — `0 14 * * *` cadence dispatch

Gate both with `CRON_SECRET` in production.

## Architecture

- **App:** Next.js 14 App Router, Tailwind — routes in `app/`, APIs in `app/api/<feature>/route.js`
- **Core:** `lib/sources.js` ingestion · `lib/match.js` scoring · `lib/hunt.js` hunt engine · `lib/apollo.js` / `lib/leadmagic.js` contacts · `lib/ai.js` generation · `lib/dispatch.js` send · `lib/video.js` HeyGen · `lib/db.js` multi-tenant KV
- **Companion:** `extension/` — Gigaprowl LinkedIn Engine (MV3); see `extension/README.md`
- **Docs:** product/architecture + GTM under `docs/`
