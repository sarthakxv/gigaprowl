# Gigaprowl — the smartest job hunter in the world

Agentic job-hunting SaaS. Upload a resume → AI profiles you → daily scanner pulls live jobs from top-company boards → matches are scored → one click ("Hunt this") finds the hiring manager, builds a personalized pitch page + AI avatar video, and runs a multi-step email/LinkedIn cadence. Credit-based plans via Stripe.

Live: https://gigaprowl.vercel.app

## Run it

```bash
npm install
cp .env.example .env    # add keys you have (app degrades to demo mode without them)
npm run dev             # http://localhost:3000
```

## What's real vs. keyed vs. fallback

| Capability | Status |
|---|---|
| Auth | Supabase Auth SSR cookies: Google sign-in and email magic links. Configure the project, redirect allowlist, and Resend SMTP before use |
| Resume parsing (PDF/DOCX/TXT) | **Real** — heuristic parser works keyless; `ANTHROPIC_API_KEY` for full AI parsing |
| Job ingestion | **Real, keyless** — Remotive + Greenhouse / Lever / Ashby (+ more) boards; `ADZUNA_APP_*` adds an aggregator. Demo seeds are development-only |
| Matching | **Real** — skills, seniority, product/services fit, ranked scores (`src/lib/match.js`) |
| Hiring-manager discovery | Keyed — `APOLLO_API_KEY` (+ optional `LEADMAGIC_API_KEY`); no fabricated production contacts |
| Pitch pages + cadences | **Real** — AI-generated with key, templates without. Live at `/p/<slug>` |
| Avatar video | Parked behind `VIDEO_GENERATION_ENABLED=false` |
| Email send | Keyed — Gmail OAuth send-as / drafts (`GOOGLE_CLIENT_*`, `GMAIL_TOKEN_ENCRYPTION_KEY`). Resend is transactional-only (`RESEND_API_KEY`) |
| LinkedIn send | **Real** — Chrome extension (`extension/`) queues invites/DMs from the user's browser session; optional Unipile managed path (`UNIPILE_*`) |
| Payments | Keyed — Stripe Checkout + webhook (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) |
| Persistence | Supabase Postgres private `app` schema for durable state; Upstash KV for expiring cache, counters, and OAuth state only |

## Daily jobs

Vercel Cron (`vercel.json`):

- `GET/POST /api/jobs/sync` — `0 6 * * *` top-company job scan
- `/api/cron/scheduler` — `0 14 * * *` cadence dispatch

Both routes reject missing or invalid `CRON_SECRET` in every environment.

## Architecture

- **App:** Next.js 14 App Router, Tailwind — routes in `src/app/`, APIs in `src/app/api/<feature>/route.js`
- **Core:** `src/lib/sources.js` ingestion · `src/lib/match.js` scoring · `src/lib/hunt.js` hunt engine · `src/lib/apollo.js` / `src/lib/leadmagic.js` contacts · `src/lib/ai.js` generation · `src/lib/dispatch.js` send · `src/lib/video.js` HeyGen · `src/lib/db.js` compatibility facade · `src/lib/durable.js` Postgres operations
- **Companion:** `extension/` — Gigaprowl LinkedIn Engine (MV3); see `extension/README.md`
- **Docs:** product/architecture + GTM under `docs/`
