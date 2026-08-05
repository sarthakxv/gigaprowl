# Prowl v2 — Architecture & Product Spec

**Product:** Prowl (prowl-livid.vercel.app) — B2C AI job-hunt autopilot.
**Thesis:** Everyone else automates *applying*. Prowl automates *getting noticed*.
**Date:** 2026-07-14 · **Status:** Draft for build · **Current stack:** Next.js 14 on Vercel, Upstash Redis (per-user JSON blobs via `lib/db.js`, shared job pool ~1MB), cookie sessions (HMAC + scrypt), Stripe checkout live, no email verification.

Keys in hand: Anthropic, Apollo, Parallel.ai, Adzuna, Smartlead, PhantomBuster, HeyGen. Owner to provide: Resend, Stripe (live), Clay, AWS, Postgres.

---

## 1. Competitor teardown: Tsenta

### What it is
Tsenta (tsenta.com, **Y Combinator-backed**) is an AI job-application agent. Verified from their live site (July 2026):

- **Watches 50,000+ company career pages** across **19+ ATSes** (Workday, Greenhouse, Lever, Ashby named explicitly) and applies "the moment a fitting role goes up." Core promise: *be in the first 100 applicants*.
- **Per-role resume + cover-letter tailoring** ("keyword-aligned, recruiter-readable, ATS-safe"), with a **diff view the user approves before anything is sent** — human-in-the-loop by design.
- **Application receipts:** exact fields filled, answers to open-ended questions, ATS confirmation. Statuses auto-routed from recruiter email replies into a tracker (Applied → Viewed → Replied → Interview).
- **Four surfaces:** web dashboard, iMessage/WhatsApp ("New match: 94%. Apply?" → reply "yes"), Chrome extension (form auto-fill on any posting), and an **MCP server/CLI** so Claude Code etc. can apply on the user's behalf.
- Handles work-authorization/OPT filtering, sponsorship signals.

### Pricing (usage-based, "pay for applications, not the tool")
| Tier | Price | Volume | $/application |
|---|---|---|---|
| Free | $0 | 25 apps, no card | — |
| Starter | $19/mo | 600 apps / 30 days | $0.032 |
| Pro ("most popular") | $39/mo | 1,500 apps | $0.026 |
| Power | $99/mo | 4,500 apps | $0.022 |

Every tier is the full product; tiers differ only by volume. They bill only "jobs actually submitted."

### Strengths vs. Prowl
1. **Speed-to-apply moat** — 50k crawled career pages, sub-minute detection. This is real infrastructure we cannot match in 4 weeks.
2. **ATS breadth** — 19 ATSes including Workday (the hardest: login walls, multi-page wizards).
3. **Trust UX** — approve-before-send diffs, receipts, "no automated flag in the submission." They've thought hard about the "will recruiters know?" objection.
4. **Distribution surfaces** — iMessage + MCP is clever, low-friction re-engagement.
5. **YC brand + free tier** — 25 free apps is a strong top-of-funnel.

### Gaps — where Tsenta stops
1. **Tsenta ends at the ATS submit button.** Volume applying is a race to the bottom: when everyone's agent applies in the first hour, "first 100 applicants" stops being an edge. Tsenta makes you *one of the fastest resumes in the pile* — still a resume in a pile.
2. **No human targeting.** No hiring-manager discovery, no outreach, no email/LinkedIn cadences.
3. **No assets.** No pitch pages, no video, no portfolio of "here's me doing your job." A tailored PDF is the ceiling of their personalization.
4. **No social/content layer.** Nothing that builds the candidate's public footprint toward a target company.
5. **Spray positioning invites platform backlash.** "Hundreds of applications a week" is exactly what ATS vendors and recruiters are building filters against. Being the anti-spray brand is both a moral and durability position.

### Prowl positioning against Tsenta
> **Tsenta gets you applied. Prowl gets you noticed.**

- Prowl treats the top ~5 matches per week like **target accounts in an ABM campaign**, not rows in a spreadsheet: a personal pitch landing page (`prowl.app/p/{slug}` — already built), an AI avatar video addressed to the hiring manager, the manager's verified contact, and a multi-touch outreach cadence.
- We *include* auto-apply as table stakes for the 50–75 score band (see §2) so we're never feature-short in a comparison — but the marketing, pricing, and dashboard all center on "top accounts landed," not "applications sent."
- Pricing consequence: Tsenta sells volume at ~$0.03/app; Prowl sells **outcomes-per-target** at $49–99/mo for 20–40 top-account treatments. Different unit, no price war.
- One-liner for the landing page: *"500 applications gets you 500 rejections faster. 5 hiring managers who watched your video gets you interviews."*

---

## 2. Tiered hunt engine

Daily scan (existing `app/api/jobs/sync` cron) scores every new job 0–100 against the structured profile (existing `lib/match.js`, moving to Claude-assisted rubric below). Score routes the job into one of three lanes:

| Band | Label | Treatment | Weekly cap (Plus / Max) |
|---|---|---|---|
| **≥ 75** | Top account | Tailored resume + pitch landing page + HeyGen avatar video + hiring-manager contacts (Apollo→Clay waterfall) + 4-touch outreach cadence + optional social posts (§6) | 3 / 7 |
| **50–74** | Auto-apply | Tailored resume + auto-submitted application (where safely supported) + tracker entry | 15 / 50 |
| **< 50** | Ignore | Logged in `matches` with `status='ignored'` for tuning; never shown unless user browses | — |

Caps exist because top-account treatment costs real money (§8) and because outreach quality collapses past ~1/day. Users can manually promote any 50–74 job to top-account (burns a credit from `credits_ledger`).

### Scoring
Two-stage to control LLM cost:
1. **Cheap filter:** embedding cosine similarity (title+skills vs profile) + hard filters (location, visa, seniority, salary floor). Kills ~80% of the pool. Run with `text-embedding` or a keyword scorer; no Claude call.
2. **Claude rubric scorer** (Haiku-class) on survivors: returns JSON `{score, reasons[], missing[], seniority_fit, comp_fit}`. Prompt includes the rubric weights explicitly (skills overlap 40, seniority 20, domain 15, location/visa 15, comp 10) so scores are stable across runs. Store `score_breakdown` JSONB on `matches`.

### Auto-apply mechanics — the honest version

**What's realistically automatable, per ATS:**

- **Greenhouse:** Job boards expose `boards-api.greenhouse.io/v1/boards/{org}/jobs/{id}?questions=true` (public, no auth) which returns the exact question schema, and applications can be POSTed to the board's application endpoint (`.../jobs/{id}` multipart POST) *when the org has the public API application flow enabled*. Many orgs do. This is the best-case ATS: structured questions, documented fields, resume as multipart file. **Do this first, server-side, no browser.**
- **Lever:** `api.lever.co/v0/postings/{org}?mode=json` for listings; postings accept POSTs to `jobs.lever.co/{org}/{id}/apply` — but this form is protected by a CSRF token and increasingly by hCaptcha. Server-side POST works for a subset of orgs; treat per-org success as discovered capability (store `apply_method` on `jobs`).
- **Ashby:** public `posting-api` for listings; application submission has a JSON endpoint used by their hosted forms, but it's undocumented — same "try, record, fall back" approach.
- **Workday / Taleo / SuccessFactors:** account creation, login walls, multi-page wizards, aggressive bot detection. **Do not attempt server-side in v2.** This is exactly why Tsenta runs browser agents and keeps a human-approval step: a real browser session (Playwright/Browserbase or the user's own Chrome via extension) is the only reliable path, and even then CAPTCHAs and "Needs you" states (visible in Tsenta's own UI!) require the human.

**ToS / CAPTCHA / risk register:**

| Risk | Reality | Mitigation |
|---|---|---|
| ATS ToS prohibit automated submission | Greenhouse/Lever ToS restrict scraping and automated access; public board APIs are a gray-to-acceptable zone since they exist to power custom career sites | Use only public/intended endpoints; per-org kill switch; honor robots.txt for crawling; never bypass auth |
| CAPTCHA (hCaptcha/Turnstile) | Blocks server-side POST on a growing share of Lever/Ashby orgs | Detect → downgrade job to **"assisted apply"**: prefill everything, deep-link the user, one click to finish. Never use CAPTCHA-solving farms (ToS + brand suicide) |
| Recruiter-side detection ("this was a bot") | Identical boilerplate answers across applicants is the tell | Every free-text answer generated per-user, per-job by Claude from the user's real profile; store the receipt like Tsenta does |
| Account bans / IP blocks | Volume from Vercel egress IPs | Route apply jobs through a small residential/ISP proxy pool later; at v2 volumes (<2k applies/day) this is not yet an issue |
| Wrong answers on legal questions (visa, EEO) | Liability | These fields are **never inferred** — collected once at onboarding, mapped deterministically, shown in the receipt |

**Human-in-the-loop default (learn from Tsenta):** first 10 auto-applies for any user require approval with a diff/receipt preview; after that, user can flip to full-auto per band. Every application writes an `events` row with the full payload receipt.

**Why competitors use browser agents:** because the server-side surface is only ~30–40% of postings. Prowl v2 scope: server-side Greenhouse (+Lever where it works) = full auto; everything else = assisted apply (prefill + deep link). Browser-agent worker (Browserbase + Playwright, run from an AWS Lambda/ECS task, *not* Vercel) is a v2.1 line item.

### Resume tailoring via Claude
- Input: structured profile JSON + job description. Output: **structured resume JSON** (not prose) → rendered to PDF with `@react-pdf/renderer` in a worker, stored in S3.
- Prompt contract: *"Reorder and rephrase using only facts present in the profile. Never invent employers, dates, titles, metrics, or credentials. Return a `changes[]` array of {before, after, reason}."* The `changes[]` array powers the Tsenta-style diff view — copy that UX shamelessly, it's correct.
- Model: Sonnet-class for ≥75 band, Haiku-class for 50–74 band. Cache the base resume render; only regenerate deltas.
- Store as `pitches.resume_json` + `resume_pdf_url`; keyed by (user, job) so re-applies reuse it.

---

## 3. Auth hardening + email flow

Current state: HMAC cookie sessions + scrypt passwords (fine, keep scrypt), **no email verification, no reset, no rate limiting**. Fixes, all shippable in ~3 days once Resend key lands:

### Email verification (Resend)
1. Signup → create user with `email_verified_at = NULL` → generate 32-byte random token, store **sha256(token)** in `email_tokens` (purpose `verify`, TTL 24h, single-use) → Resend sends link `/auth/verify?token=...`.
2. Verify route: hash incoming token, match, check expiry, set `email_verified_at = now()`, delete token, log user in.
3. Gate: unverified users can browse but **cannot start a hunt or trigger outreach** (outreach from unverified accounts is how you burn a sending domain).
4. Resend domain setup: dedicated subdomain `mail.prowl.app` with SPF/DKIM/DMARC; transactional only on this domain — outreach mail goes through Smartlead-managed inboxes, never the app domain.

### Password reset
Same token table, purpose `reset`, TTL 1h. Always respond "if that email exists, we sent a link" (no enumeration). On successful reset: rotate `session_version` on the user row → all existing sessions die.

### Magic link (recommended as the *default* sign-in)
Same mechanism, purpose `magic`, TTL 15m. B2C job seekers churn passwords; magic link + optional password removes the reset-flow support load. Rate limit: 3 sends / email / hour.

### Rate limiting (`@upstash/ratelimit`, sliding window)
| Route | Limit |
|---|---|
| POST /api/auth/login | 10 / 15min / IP, 5 / 15min / email |
| POST /api/auth/signup | 5 / hour / IP |
| Token sends (verify/reset/magic) | 3 / hour / email |
| POST /api/video/build, /api/outreach | plan-based, backed by `credits_ledger` |
| All API, global | 100 / min / user (middleware) |

### Session hardening
- Cookie: `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Move from pure HMAC-payload cookies to **server-side sessions**: cookie holds opaque `session_id`; Redis `session:{id}` → `{user_id, created, ua_hash}` TTL 30d, sliding. Enables logout-everywhere and revocation (impossible with stateless HMAC).
- Include `session_version` check against the user row (bump on password change/reset).
- CSRF: keep to POST + SameSite=Lax + origin-header check in middleware (sufficient for cookie auth without cross-site embeds).
- Add basic audit: `events` rows for login, failed login, reset, verification.

---

## 4. Database migration: Neon Postgres + Redis demoted to cache

**Choice: Neon** (or Vercel Postgres, which is Neon-backed — same thing; take Neon direct for branch-per-PR and clearer pricing). Serverless driver (`@neondatabase/serverless`) over HTTP/WebSocket works in Vercel functions without pool exhaustion; use **Drizzle ORM** (schema-as-code, SQL-first, tiny runtime — better fit than Prisma for serverless cold starts).

### Schema (SQL sketch)

```sql
-- users & auth
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text,                          -- null for magic-link-only users
  email_verified_at timestamptz,
  session_version int NOT NULL DEFAULT 1,
  plan          text NOT NULL DEFAULT 'free',  -- free | plus | max
  stripe_customer_id text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_tokens (
  token_hash  bytea PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('verify','reset','magic')),
  expires_at  timestamptz NOT NULL
);

-- profile: structured resume, one active per user (keep versions)
CREATE TABLE profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version     int NOT NULL DEFAULT 1,
  raw_text    text,                 -- original upload extraction
  data        jsonb NOT NULL,       -- structured: skills[], roles[], education[], answers{visa, salary_floor,...}
  embedding   vector(1536),         -- pgvector, for stage-1 match filter
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_profile ON profiles(user_id) WHERE is_active;

-- shared job pool (replaces the 1MB Redis blob)
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,       -- adzuna | greenhouse | lever | ashby | manual
  external_id  text NOT NULL,
  company      text NOT NULL,
  company_domain text,
  title        text NOT NULL,
  location     text, remote boolean,
  salary_min   int, salary_max int,
  description  text,
  apply_url    text,
  apply_method text NOT NULL DEFAULT 'link', -- gh_api | lever_post | assisted | link
  ats          text,
  posted_at    timestamptz,
  raw          jsonb,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX jobs_recent ON jobs (posted_at DESC);
CREATE INDEX jobs_company ON jobs (company_domain);

-- user x job scoring result
CREATE TABLE matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score       int NOT NULL,
  band        text NOT NULL,        -- top | apply | ignored
  score_breakdown jsonb,
  status      text NOT NULL DEFAULT 'new', -- new | queued | active | applied | replied | interview | rejected | ignored
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
CREATE INDEX matches_user_band ON matches (user_id, band, status);

-- a hunt = the campaign wrapper for one match (top-account treatment or auto-apply)
CREATE TABLE hunts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  match_id    uuid NOT NULL UNIQUE REFERENCES matches(id),
  tier        text NOT NULL,        -- top | apply
  state       text NOT NULL DEFAULT 'pending',
  -- pending | tailoring | assets_ready | awaiting_approval | outreach_live | applied | done | failed
  applied_at  timestamptz,
  receipt     jsonb,                -- application receipt (fields sent, answers)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- generated assets per hunt
CREATE TABLE pitches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id       uuid NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  slug          text UNIQUE NOT NULL,          -- /p/{slug}
  page_json     jsonb,                         -- pitch page content blocks
  resume_json   jsonb,
  resume_pdf_url text,                         -- S3
  video_script  text,
  video_status  text DEFAULT 'none',           -- none|queued|rendering|ready|failed
  heygen_video_id text,
  video_url     text,                          -- S3 copy (HeyGen URLs expire)
  views         int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- hiring-manager / recruiter contacts per hunt
CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id     uuid NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  name        text, title text,
  email       text, email_status text,   -- verified | catch_all | guessed | none
  linkedin_url text,
  source      text,                      -- apollo | clay | parallel
  enrichment  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- outreach cadence + steps
CREATE TABLE cadences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id     uuid NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  contact_id  uuid REFERENCES contacts(id),
  channel     text NOT NULL,             -- email | linkedin | social
  state       text NOT NULL DEFAULT 'draft', -- draft | approved | live | paused | done
  steps       jsonb NOT NULL,            -- [{day:0, template, subject, status, sent_at}, ...]
  smartlead_campaign_id text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- append-only activity log (auth, applies, sends, opens, page views, webhook events)
CREATE TABLE events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid, hunt_id uuid,
  type        text NOT NULL,
  data        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_user ON events (user_id, created_at DESC);

-- metered usage: videos, top-account credits, applies
CREATE TABLE credits_ledger (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  delta       int NOT NULL,              -- +grant / -spend
  kind        text NOT NULL,             -- top_account | apply | video | social_post
  ref_id      uuid,                      -- hunt/pitch id
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- balance = SUM(delta) per (user, kind); enforce >= 0 in app layer inside a tx.
```

Extensions: `pgvector` (profile/job embeddings), `citext`.

### What stays in Redis (Upstash)
- **Rate-limit counters** (`@upstash/ratelimit`).
- **Sessions** (`session:{id}`, TTL).
- **Hot caches:** rendered job-feed page per user (TTL 10m), match-feed JSON, Apollo/Clay enrichment responses keyed by `person:{domain}:{title-hash}` (TTL 30d — enrichment is expensive, cache aggressively).
- **QStash/Inngest is the queue** (§5) — do not build a Redis list queue.
- The 1MB shared job-pool blob **dies**; jobs live in Postgres.

### Migration plan (zero-downtime, ~2 days)
1. Provision Neon, run Drizzle migrations, deploy code that has both drivers.
2. **Backfill script** (one-off, run locally against prod Redis): `SCAN` all user keys from current `lib/db.js` conventions → insert into `users/profiles/matches/pitches`; parse the shared job-pool blob → `jobs`. Idempotent upserts so it can re-run.
3. **Dual-write window (1–3 days):** writes go to Postgres *and* legacy KV; reads from Postgres with KV fallback + repair-on-read. Log any fallback hit.
4. Flip reads fully to Postgres, stop dual writes, keep KV snapshot 30 days, delete.
5. Passwords: scrypt hashes copy over verbatim (same verify code). Sessions: users get logged out once at cutover — acceptable; announce it.

### Caching strategy
- **Job pool:** Postgres is the source of truth; the daily scan queries `jobs WHERE fetched_at > now()-interval '36 hours'`. Cache the per-user scored feed in Redis 10m.
- **Profile:** cache structured profile JSON in Redis (TTL 1h, bust on edit) — it's read on every scoring pass.
- **Pitch pages (`/p/[slug]`):** convert to **ISR** — `revalidate: false` + `revalidateTag('pitch:'+slug)` on edit, and `unstable_cache`/tag for the view. These pages get shared with hiring managers; they must be <100ms and survive traffic spikes. View counter increments via a lightweight edge route writing to Redis, flushed to Postgres hourly (don't bust ISR for a counter).
- **Resume PDFs / videos:** S3 + CloudFront (or S3 presigned via Vercel), immutable URLs.

---

## 5. Queue / worker layer

**Recommendation: Inngest.** Reasoning:
- Prowl's long jobs are **multi-step workflows**, not fire-and-forget HTTP: a top-account hunt is *tailor resume → build pitch page → request HeyGen render → wait (webhook, minutes) → store video → find contacts → wait for user approval (possibly days) → start cadence*. Inngest's step functions give per-step retry, `step.waitForEvent()` (perfect for both the HeyGen webhook *and* the human-approval gate), `step.sleep()` for cadence delays, and concurrency/throttle keys per user. QStash would force us to hand-roll a state machine across `hunts.state` — which is exactly the bug farm we're trying to avoid.
- First-class Vercel integration: functions deploy inside the Next.js app (`/api/inngest`), auto-registered on deploy; no separate worker infra. Each *step* is its own function invocation, so Vercel's per-function timeout applies per step, not per workflow.
- Keep QStash in the back pocket for dumb scheduled pings if needed; but one orchestrator is better than two.

### Functions
| Function | Trigger | Steps / notes |
|---|---|---|
| `jobs/scan.daily` | cron `0 6 * * *` + per-user stagger | fetch Adzuna + GH/Lever boards → upsert `jobs` → fan out `match/score.user` events |
| `match/score.user` | event | stage-1 filter → Claude rubric → write `matches`, emit `hunt/requested` for auto-banded ones within caps |
| `hunt/run.top` | event | tailor resume → pitch page → **`step.run` HeyGen create** → **`step.waitForEvent('heygen/video.done', timeout 30m)`** → S3 copy → contacts (Apollo→Clay) → draft cadence → `waitForEvent('hunt/approved', timeout 7d)` → push cadence to Smartlead |
| `hunt/run.apply` | event | tailor resume → attempt gh_api/lever_post → on CAPTCHA/failure mark `assisted` + notify user → write receipt |
| `cadence/tick` | event + `step.sleep` per step | send step N via Smartlead/Resend, sleep until step N+1 |
| `social/generate` | event (§6) | generate LinkedIn post + thread + video script → await review |
| `email/*` | events | verification, digests ("3 new top accounts today") |

### Retry semantics
- Default: 4 retries, exponential backoff (Inngest default), per step.
- **Non-retriable** (`NonRetriableError`): CAPTCHA detected, 4xx from ATS, HeyGen quota exceeded, contact-not-found. These flip the hunt to a user-visible "needs you" state instead of burning retries.
- **Idempotency:** every external mutation carries an idempotency key = `hunt_id:step_name`; HeyGen create checks `pitches.heygen_video_id` first; applies check `hunts.applied_at`. Inngest event `id` set to dedupe fan-out.
- Dead-lettered runs → `events` row + owner alert (Resend email to admin) — at this scale that's enough observability, plus the Inngest dashboard.

### HeyGen webhook
- Register webhook endpoint `POST /api/webhooks/heygen` for `avatar_video.success` / `avatar_video.fail`; verify HeyGen signature; translate into an Inngest event `heygen/video.done {video_id, url}` which resolves the waiting step. Also run a 10-minute polling fallback step (HeyGen webhooks occasionally drop).
- On success: **download the MP4 to S3 immediately** — HeyGen share URLs are not permanent and you don't want pitch pages hotlinking them.
- Same pattern for Stripe (`/api/webhooks/stripe`, already partially built) and Smartlead reply webhooks (reply → `matches.status='replied'`, pause cadence).

---

## 6. Agentic social-posts feature ("Signal Boost")

**Concept:** for a top-account hunt, Prowl generates public content that makes the candidate *discoverable by the target company* — an indirect pitch: their real work mapped to the company's visible needs, never "please hire me."

### Inputs
- Structured profile (skills, shipped projects, metrics).
- Target job description + company research (existing `lib/research.js` + Parallel.ai company brief: recent launches, tech stack, hiring themes across their other open roles).
- Voice sample: 2–3 of the user's past posts if provided, else tone picker (direct / story / technical).

### Outputs per (user, target company)
1. **LinkedIn post** (900–1,300 chars): hook → a concrete workflow/result from the user's history that maps to the company's need → one insight → soft CTA ("If you're working on X, I'd love to compare notes"). Company named at most once, or not at all (tag-free variant) — the goal is to *rank in the feeds of that company's employees*, not to beg.
2. **Twitter/X thread** (5–7 tweets): same story, tighter, ends with link to the pitch page (which is the conversion surface — it has the video).
3. **Video script** (45–60s, public-facing variant of the pitch video): re-usable with the user's HeyGen avatar; framed as "how I'd approach {problem the company visibly has}", not addressed to a person.

### Prompt design (sketch)
```
System: You ghostwrite for {name}. Voice: {voice_profile}. Hard rules:
- Use ONLY facts from <profile>. Never invent metrics, employers, or claims.
- Do not mention that {company} is hiring, do not ask for a job, do not @-mention execs.
- One idea per post. No hashtag walls (max 2). No "I'm excited to share".
- Output JSON: {linkedin_post, tweet_thread[], video_script, rationale, facts_used[]}
User: <profile>{...}</profile> <company_brief>{...}</company_brief>
<target_role>{...}</target_role> <past_posts>{...}</past_posts>
Task: one LinkedIn post + one X thread + one 60s video script that demonstrate
{name}'s workflow on a problem {company} visibly cares about ({signal}).
```
`facts_used[]` is checked against the profile server-side (string containment on metrics/claims) — a cheap hallucination tripwire before anything reaches the user.

### Review-before-post UX (mandatory — never auto-post in v1)
- Drafts land in a **review queue**: editable text, regenerate-with-note, tone slider, per-platform preview. State machine on `cadences` rows with `channel='social'`: `draft → approved → scheduled → posted`.
- Approval writes an `events` row; nothing is ever published without an explicit approve.

### Posting mechanics
- **v1: copy-to-clipboard + scheduled reminders.** LinkedIn's Share API (`w_member_social`) requires an approved app + user OAuth and is heavily restricted; X API write access is $200/mo tier. Not worth it for launch. Instead: at the scheduled slot, Resend email + in-app nudge with the post pre-filled, one-tap copy, deep link to the composer (`linkedin.com/feed/?shareActive=true&text=` prefill works for basic text). Honest, zero platform risk, ships in a day.
- **v2: assisted automation.** PhantomBuster (key in hand) LinkedIn auto-post phantom using the user's session cookie — works but is against LinkedIn ToS and risks *user* account restrictions: strictly opt-in with an explicit warning, capped at 2 posts/week, human-approved content only. Clay can orchestrate the same via HTTP/webhook columns. Long-term correct path: apply for LinkedIn Community Management API access once there's volume to justify it.

### Cadence
- **2 posts/week per target account, max 3 posts/week per user total** across accounts (feed fatigue is real; also keeps LLM cost bounded). Alternating platform. Cadence auto-pauses when the hunt closes (reply/interview/rejection).
- Measure: pitch-page UTM per post → `events` → show "3 people from {company} viewed your pitch page" (IP-to-company via Clay/RB2B-style enrichment is a v2.1 delight feature).

---

## 7. Clay integration

Clay is the **enrichment orchestrator**, not another data vendor. Use it where waterfalls and signals beat single-source lookups:

1. **Hiring-manager waterfall (primary use):** Prowl webhook → Clay table → find people at `{company_domain}` with titles matching the role's likely manager (e.g., "Engineering Manager, Platform" for a platform-eng job) → **email waterfall across 10+ providers** (Prospeo, Datagma, LeadMagic, Hunter…) with built-in verification → HTTP API callback to `POST /api/webhooks/clay` → write `contacts` with `email_status`. Waterfalls typically lift verified-email hit rate from ~50–60% (Apollo alone) to ~80%+, and you pay only for hits.
2. **Intent signals:** Clay monitors on target companies — job-posting velocity (they're scaling the team = warmer), new funding, tech-stack detection, recent hires in the same org (manager likely still building). Feed these into the outreach copy ("saw you're scaling the platform team after the Series B…") and into match scoring as a bonus signal.
3. **Claygent** for the long tail: scrape "team" pages / conference talks for companies where structured providers miss (startups <50 people — a big share of top matches).

**Division of labor:**
| Layer | Tool | Why |
|---|---|---|
| First-pass person search + title match | **Apollo** (key in hand, cheap credits, good API) | Fast, synchronous, fine for the 60% easy cases |
| Email verification + waterfall fallback when Apollo returns nothing/guessed | **Clay** | Pay-per-hit waterfall, best coverage |
| Company research briefs, news, deep unstructured lookups | **Parallel.ai** | Built for agentic web research; feeds pitch pages, video scripts, social posts |

Flow: Apollo first (free-ish) → if `email_status != verified`, escalate to Clay → cache result 30 days in Redis + `contacts.enrichment`. Budget guard: max 2 Clay escalations per hunt.

---

## 8. Infra scaling plan to 100k users

Assumptions per **active** user/month: 20 auto-applies, 6 top-account hunts, 6 videos @ ~50s Avatar IV-quality ≈ $3.30 HeyGen (at $4/min; standard $1/min drops this to ~$0.85 — **use standard quality by default, Avatar IV as a Max-tier perk**), ~400k Claude tokens ≈ $1.20 blended, Apollo/Clay ≈ $1.00, email ≈ $0.10. Assume 40% of registered users are active in a month.

### Cost & architecture by stage
| | 1k users | 10k users | 100k users |
|---|---|---|---|
| Vercel | Pro $20 | Pro + usage ~$150 | ~$1.5–3k (or Enterprise; move heavy compute off) |
| Neon Postgres | Launch ~$19 | Scale ~$70–150 | ~$700+ (or RDS ~$500) |
| Upstash Redis | ~$10 | ~$50 | ~$250 |
| Inngest | free/$0 | ~$75–150 | ~$500–1k (volume-priced) |
| HeyGen (std quality) | ~$340 | ~$3.4k | ~$34k ← biggest COGS line |
| Anthropic | ~$480 | ~$4.8k | ~$48k → prompt caching + Haiku routing cuts ~40% |
| Apollo + Clay | ~$400 | ~$2.5k | ~$15k (negotiate Clay enterprise) |
| Resend + Smartlead | ~$50 | ~$300 | ~$2k |
| AWS (S3/CloudFront, later ECS) | ~$5 | ~$50 | ~$500–1.5k |
| **Total infra/COGS** | **~$1.3k/mo** | **~$11.5k/mo** | **~$103k/mo** |

**Architecture inflection points:**
- **@1k:** everything on Vercel + Neon + Inngest + Upstash. Add **S3 from day one** for PDFs/MP4s (do not store media in Redis or Vercel Blob at these unit prices).
- **@10k:** move job-pool crawling to a scheduled **AWS ECS/Fargate task** (long-running, cheap, own egress IPs); pgvector index maintenance; read replica for feed queries; CloudFront in front of S3.
- **@100k:** dedicated Postgres (Neon Scale/RDS), SQS + Lambda for the apply/browser-agent fleet (Inngest stays as orchestrator, SQS feeds the heavy workers), negotiate HeyGen enterprise ($1/min list has volume room), consider self-hosted avatar pipeline (e.g., open-source talking-head models) to attack the biggest COGS line.

### Unit economics per subscriber (monthly)
| | Plus $49/mo | Max $99/mo |
|---|---|---|
| Included | 12 top accounts (3/wk), 60 applies, videos std quality | 28 top accounts, 200 applies, Avatar IV video, social boost |
| HeyGen | $10.20 (12 × 50s std) | $37.30 (28 × 50s IV) |
| Claude | $2.50 | $6.00 |
| Enrichment (Apollo+Clay) | $2.00 | $4.50 |
| Email/Smartlead + misc infra | $1.30 | $2.20 |
| **COGS** | **~$16.00** | **~$50.00** |
| **Gross margin** | **~67%** | **~50%** |

Max margin is thin because of Avatar IV — either price Max at $129 or make IV-quality an add-on. Free tier: 1 top-account hunt total (not per month) as the "wow" moment, no video download, watermarked pitch page.

### The 5 things that break first
1. **Redis 1MB job-pool blob** — breaks at ~1,500 jobs; already near the cliff. *Fix:* §4 — jobs to Postgres, done in week 1.
2. **Vercel function timeouts** — daily scan + scoring for N users in one cron invocation dies past ~200 users; video/apply flows can't run inline at all. *Fix:* §5 — Inngest fan-out; one event per user; each step < 60s.
3. **HeyGen quota/cost** — API wallet drains fast; renders queue at peak. *Fix:* per-plan video credits via `credits_ledger`; render queue with per-user concurrency 1; standard quality default; pre-buy credits; alert at 70% wallet.
4. **Apollo credits** — contact lookups on every top hunt burn the plan's credit pool within weeks. *Fix:* 30-day Redis enrichment cache (contacts don't change weekly), Apollo→Clay escalation only on miss, hard budget of 2 escalations/hunt, monthly credit alarm.
5. **Email deliverability** — the true existential risk: cold outreach from a shared domain gets prowl.app blocklisted and *transactional* email dies with it. *Fix:* strict domain separation (transactional = `mail.prowl.app` via Resend; outreach = Smartlead-managed inboxes on user-adjacent or purchased domains, warmed 2 weeks, ≤30 sends/inbox/day); mandatory human approval on cadence copy; global suppression list in Postgres; kill switch per sending domain on bounce rate >3%.

---

## 9. Build order — 4-week sprint plan

### Week 1 — Foundation (DB + auth)
Everything else depends on this. **Env keys:** `DATABASE_URL` (Neon), `UPSTASH_REDIS_REST_URL/TOKEN` (existing), `RESEND_API_KEY`, `SESSION_SECRET`, `S3_BUCKET`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`.
- [ ] Neon + Drizzle, full schema (§4), pgvector
- [ ] Backfill script from Redis KV; dual-write shim in `lib/db.js`
- [ ] Server-side sessions, `__Host-` cookie, rate limiting middleware
- [ ] Email verification + password reset + magic link (Resend)
- [ ] S3 media store; move existing pitch assets/HeyGen outputs to S3
- **Exit test:** new signup → verify email → magic-link login → old user's data intact from Postgres.

### Week 2 — Engine (queue + tiered hunts)
Depends on: schema, S3. **Env keys:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `ANTHROPIC_API_KEY` (existing), `ADZUNA_APP_ID/KEY` (existing), `HEYGEN_API_KEY` (existing), `HEYGEN_WEBHOOK_SECRET`.
- [ ] Inngest installed; port `jobs/sync` cron → `jobs/scan.daily` + per-user fan-out
- [ ] Two-stage scorer (embeddings + Claude rubric) writing `matches` with bands
- [ ] `hunt/run.top` workflow incl. HeyGen webhook + S3 copy + poll fallback
- [ ] Resume tailoring (structured JSON + diff `changes[]`) + PDF render worker
- [ ] Greenhouse public-API auto-apply + receipt; assisted-apply fallback UX
- **Exit test:** seeded profile → scan → one ≥75 hunt produces page+video+resume unattended; one 50–74 job auto-applies to a live Greenhouse board (use a friendly test org).

### Week 3 — Outreach + monetization
Depends on: hunts producing assets. **Env keys:** `APOLLO_API_KEY` (existing), `CLAY_WEBHOOK_URL`/`CLAY_API_KEY`, `PARALLEL_API_KEY` (existing), `SMARTLEAD_API_KEY` (existing), `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (live), `STRIPE_PRICE_PLUS`/`STRIPE_PRICE_MAX`.
- [ ] Apollo→Clay contact waterfall + `contacts` + enrichment cache
- [ ] Cadence builder (Claude drafts, 4 touches) + approval gate + Smartlead push + reply webhook → tracker status
- [ ] `credits_ledger` enforcement wired to plans; Stripe live mode, webhook → plan sync; upgrade/downgrade + paywall states
- [ ] Pitch pages → ISR + view tracking + UTM
- **Exit test:** full loop — top hunt → approve cadence → email actually lands in a test inbox → reply flips status to `replied`; Plus checkout grants correct credits.

### Week 4 — Social boost + hardening + launch
Depends on: everything. **Env keys:** none new for v1 social (copy-to-clipboard); optional `PHANTOMBUSTER_API_KEY` (existing) behind a feature flag.
- [ ] Social generator (§6) + review queue + scheduled reminders (2/wk/account)
- [ ] Dashboard v2: pipeline view (Tsenta-style tracker but hunts-first), receipts, "needs you" queue
- [ ] Load test scan fan-out at 1k synthetic users; retry/idempotency audit; kill switches (per-ATS apply, per-domain email)
- [ ] Delete legacy KV blob path; onboarding polish; positioning page vs auto-apply tools; launch
- **Exit test:** 1k-user synthetic scan completes < 15 min; zero duplicate applies/videos under forced retries.

**Dependency spine:** Postgres → Inngest → hunts → outreach → social. Do not start Week 2 until the backfill has run clean against prod data.

---

*Sources: [tsenta.com](https://tsenta.com) (fetched 2026-07-14), [LoopCV Tsenta review](https://www.loopcv.pro/directory/tsenta/), [HeyGen API pricing](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained), [Inngest background jobs guide](https://www.inngest.com/docs/guides/background-jobs), [QStash docs](https://upstash.com/docs/qstash/features/background-jobs), [QStash vs Inngest vs SQS](https://apiscout.dev/guides/upstash-qstash-vs-inngest-vs-aws-sqs-2026).*
