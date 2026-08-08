# Gigaprowl — the smartest job hunter in the world

Agentic job-hunting SaaS MVP. Upload a resume → AI profiles you (product vs. services fit, skills, seniority) → daily scanner pulls live jobs from top-company boards → matches are scored → one click ("Hunt this") finds the hiring manager, generates a personalized pitch landing page + 60-second video script, and drafts a 4-step email/LinkedIn cadence. Credit-based pricing baked in.

## Run it

```bash
npm install
cp .env.example .env    # add keys (all optional — app degrades to demo mode)
npm run dev             # http://localhost:3000
```

## What's real vs. keyed vs. stubbed

| Capability | Status |
|---|---|
| Resume parsing (PDF/DOCX/TXT) | **Real** — heuristic parser works keyless; add `ANTHROPIC_API_KEY` for full AI parsing |
| Job ingestion | **Real, keyless** — Remotive API + Greenhouse/Lever boards of ~16 top companies (Stripe, Figma, Anthropic, Databricks…); `ADZUNA_APP_*` adds an aggregator. Seeds demo jobs if offline |
| Matching engine | **Real** — skills overlap, seniority alignment, product/services orientation fit, ranked scores |
| Hiring-manager discovery | Keyed — `APOLLO_API_KEY` for real contacts; demo contacts otherwise |
| Cadences + pitch pages + video scripts | **Real** — AI-generated with key, template fallback without. Pitch pages hosted live at `/p/<slug>` |
| Avatar video rendering | Integration point — face/voice captured in onboarding (consented, user's own likeness); wire `HEYGEN_API_KEY` / `ELEVENLABS_API_KEY` to render |
| Sending (email/LinkedIn) | Draft + export model — connect Smartlead/PhantomBuster/Valley; direct sending is a backend-phase feature |
| Payments | Pricing UI only — wire Stripe next |

## Daily scanner

`POST /api/jobs/sync` runs the top-company scan. In production, hit it from a cron (Vercel Cron: `0 6 * * *`).

## Architecture

- Next.js 14 App Router, Tailwind, JSON-file store (`data/db.json`) — swap `lib/db.js` for Postgres when going multi-tenant.
- `lib/sources.js` job ingestion · `lib/match.js` scoring · `lib/apollo.js` contacts · `lib/ai.js` all AI generation with fallbacks.
- Single-user MVP; auth + multi-tenancy is the first backend milestone.

## Next milestones

1. Auth + multi-tenant Postgres
2. Stripe billing on the credit system
3. HeyGen/ElevenLabs video render pipeline + human approval gate
4. Smartlead/Valley send integrations + reply tracking
5. Recruiter side: paid listings + placement referral program
