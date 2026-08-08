# Gigaprowl — project package

The most ambitious agentic AI job-hunting app. Upload a resume → Gigaprowl scans 400+ startups daily, finds the hiring manager, builds a personalized pitch page + AI video, drafts multi-channel outreach, and (with the browser extension) sends LinkedIn invites/DMs and Gmail — mostly hands-off.

Live: https://prowl-livid.vercel.app

## What's in here
- `app/` — Next.js 14 (App Router) frontend + API routes (auth, resume parse, hunt, outreach, Gmail/LinkedIn connect, scheduler, HeyGen ad route, etc.)
- `lib/` — core engines: matching, contact discovery (Apollo + LeadMagic), AI (Claude) cadence/pitch/social generation, Gmail send-as, dispatch, video (HeyGen), fonts.
- `extension/` — Chrome extension ("Gigaprowl LinkedIn Engine") that runs LinkedIn invites/DMs from the user's own browser session (cookie never leaves their machine).
- `gtm/` — go-to-market: content playbook, creator/influencer plan, ads+email growth, UGC concepts, and the animated ad (`gigaprowl-morning-ad.mp4`).
- `docs/` — architecture notes.
- `GIGAPROWL-GTM-Deck.pptx / .pdf`, `GIGAPROWL-GTM-Playbook.md` — pitch/GTM materials.
- `.env.example` — the environment variables the app needs.

## Run locally
```bash
npm install
cp .env.example .env   # fill in the keys you have
npm run dev            # http://localhost:3000
```

## Keys it can use (all optional; app degrades gracefully)
- `ANTHROPIC_API_KEY` — AI parsing/generation
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — Upstash Redis (multi-tenant store)
- `APOLLO_API_KEY`, `LEADMAGIC_API_KEY` — contact discovery + email enrichment
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Gmail send-as / drafts (OAuth)
- `HEYGEN_API_KEY`, `ELEVENLABS_API_KEY` — avatar/voice pitch videos
- `FAL_KEY`, `HF_TOKEN` — UGC / marketing video generation
- `CRON_SECRET`, `SESSION_SECRET`, `PARALLEL_API_KEY`, `SMARTLEAD_API_KEY` — scheduler / signals / email sending

## Note
Secrets (`.env`) are intentionally NOT included. The latest HeyGen spokesperson ad renders live via `/api/ad/heygen`; the animated explainer is in `gtm/`.
