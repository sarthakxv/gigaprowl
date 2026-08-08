# Gigaprowl — Paid + Outbound GTM Plan
## AI UGC Mass-Production, Paid Ads (Meta + TikTok), and Cold Email at Scale

**Goal:** 10,000 users ASAP → 100,000. Pricing: $0 trial / ~$49 / ~$129 monthly.
**Existing stack:** HeyGen API, ElevenLabs, Smartlead, PhantomBuster, Apollo, Anthropic API.
**Prepared:** July 2026.

---

# SECTION A — AI UGC MASS-PRODUCTION STACK

## A1. Tool Landscape (2025–2026)

| Tool | Pricing | Per-video cost | Quality | API | Verdict for Gigaprowl |
|---|---|---|---|---|---|
| **HeyGen** (you own it) | Creator $29/mo (600 credits); API pay-as-you-go from $5; Avatar IV ≈ $4/min via API (~$2 per 30s ad) | ~$1–2 per 30s ad via API | Very good; Avatar IV lip-sync is among the best; UGC-style avatar library added 2025 | **Yes — best API in class, pay-as-you-go** | **Primary engine. You already pay for it and have the render pipeline built (task #14).** |
| **Arcads.ai** | Starter $110/mo (10 videos), Creator $220/mo (20), Pro custom w/ API. ~$11/video | ~$11+ per usable ad (re-gens for edits cost full credit) | Best-in-class realism, 300+ UGC actors; 2.8/5 Trustpilot mostly on price-to-value | Pro tier only | Use as a **quality benchmark / winner-polishing tool**, not the volume engine. Too expensive at 50–100 variants/week (~$550–1,100/wk). |
| **Creatify** | Free 10 credits; Starter ~$33–39/mo (100 credits ≈ 20 videos); Pro $49/mo (200 credits, 1,500 avatars, batch mode, ad-clone); Enterprise = API | ~$1.50–2.50/video | Good; URL-to-ad, batch mode, competitor ad tracking | Enterprise/API tier | **Best value #2 tool.** Pro plan's batch mode + ad-clone is ideal for volume testing alongside HeyGen. |
| **MakeUGC** | Startup $49/mo (5 videos), Growth $69/mo (10), Pro $119/mo (20); API Starter $99/mo | ~$6–10/video | Decent avatars; lip-sync issues on long scripts; 2.8/5 Trustpilot | Yes ($99/mo tier) | Skip — worse economics than HeyGen API, no editor. |
| **Icon.com** ("The Human Admaker") | Software from $39/mo; $399 for 6 **human-filmed** UGC ads (2 creators × 3 ads, unlimited revisions) + Admaker software (ad-spy, analytics, 1-click Meta launch) | ~$66/human ad | Real humans — highest authenticity ceiling | N/A (platform) | **Use in month 2** to get 6–12 real-human ads of proven winning scripts (TikTok Spark ads need real creators anyway). Watch for reported cancellation/billing complaints — pay by virtual card. |
| **Veo 3.1 (Google)** | Fast API $0.15/sec, Standard $0.40/sec (audio incl.); AI Plus $7.99/mo (Fast); Ultra $249.99/mo (Standard) | 15s clip: $2.25 (Fast) – $6 (Std) | Best realism + native audio for B-roll / "in-the-wild" scenes | Yes (Gemini API) | Use for **B-roll and hook scenes** (person opening laptop, phone notification, office scenes), not talking-head. |
| **Sora 2 (OpenAI)** | $0.10/sec (720p); Pro $0.30–0.50/sec; ChatGPT Plus incl. limited gens | 15s: ~$1.50 | Great physics/audio; weaker consistent talking-head | Yes | Alternative B-roll source; cheaper than Veo Standard. |
| **Kling 3.0** | $0.09–0.14/sec API | 15s: ~$1.50–2 | Popular budget option for high-volume ad B-roll | Yes | Optional cost-optimizer for B-roll at scale. |
| **CapCut** | No official public automation API (Open Platform = in-editor plugins only) | — | — | **No official API**; open-source `CapCutAPI` / capcut-mate projects generate draft files programmatically | Use CapCut manually for polish only. For programmatic assembly (captions, music, B-roll splice), use **ffmpeg or JSON2Video/Creatomate-style render APIs** in your pipeline instead. |

**Recommendation:** **HeyGen API as the primary volume engine** (~$2 per 30s ad, you already have the pipeline), **Creatify Pro ($49/mo)** as a second avatar pool + batch/ad-clone tool, **Veo 3.1 Fast** for B-roll hooks, **Arcads/Icon** reserved for polishing proven winners in month 2. Weekly creative budget at 75 variants: **~$200–350/week** — versus $825+/week on Arcads alone.

## A2. The Pipeline: 50–100 Ad Variants/Week

You already have Anthropic API + HeyGen + ElevenLabs wired into Gigaprowl's render pipeline. Repurpose it as an internal "ad factory":

```
STEP 1 — SCRIPT MATRIX (Claude API, batch)
  hooks.json (20 hooks) × angles.json (6 pain points) × personas.json (5 personas)
  → Claude generates 30–45s scripts from templates → scripts/*.json
  Cost: pennies.

STEP 2 — VOICE (ElevenLabs, ~$0.10–0.15/video)
  Optional: generate VO separately for B-roll-led variants.
  For talking-head variants, HeyGen handles voice natively.

STEP 3 — TALKING HEAD (HeyGen API, ~$2/video Avatar IV)
  Rotate 8–10 UGC-style avatars (mix gender/age/ethnicity/setting:
  car, bedroom, desk, walking). POST /v2/video/generate per script.

STEP 4 — B-ROLL LIBRARY (Veo 3.1 Fast, one-time + weekly top-ups)
  Build a reusable library of 30–50 clips: phone buzzing with "Interview
  request", laptop with Gigaprowl dashboard, stressed person at desk, offer
  letter, coffee-shop job hunt. ~$2.25 per 15s clip.

STEP 5 — ASSEMBLY (ffmpeg script or JSON2Video/Creatomate API)
  Template: [Hook: 0-3s talking head or B-roll] → [Problem: 3-10s] →
  [Demo screen-recording of Gigaprowl: 10-20s] → [Proof/result: 20-27s] →
  [CTA: 27-33s]. Auto-burn captions (big, high-contrast, TikTok-style),
  add trending-safe music bed, export 9:16 1080×1920 + 1:1 + 4:5 crops.

STEP 6 — QC + UPLOAD
  Human review (10 min/batch, kill bad lip-sync), auto-upload via Meta
  Marketing API / TikTok Ads API with naming convention applied.
```

**Throughput math:** 20 hooks × 4 scripts/hook you actually render × ~1 avatar each = 80 talking-head variants/week ≈ $160 HeyGen + $30 B-roll + $50 Creatify = **≈$240/week creative cost.** One person can run this in ~1 day/week once scripted.

## A3. Testing Taxonomy

**Personas (P):**
- `P1-LAIDOFF` — recently laid off tech worker (highest urgency, layoffs.fyi audience)
- `P2-GRAD` — new grad / 0–2 yrs, applying into the void
- `P3-SWITCHER` — employed but miserable, career changer
- `P4-SENIOR` — senior IC/manager, hates networking, values time ($129 tier)
- `P5-INTL` — visa/relocation job seekers (test carefully, high volume)

**Pain points / angles (A):**
- `A1-BLACKHOLE` — "500 applications, zero replies" (ATS black hole)
- `A2-GHOSTED` — recruiter ghosting
- `A3-TIME` — job hunting is a full-time job you don't have time for
- `A4-UNFAIR` — referrals/insiders get the jobs; Gigaprowl gets you to the hiring manager directly
- `A5-AI-EDGE` — everyone else uses AI to apply; you're behind
- `A6-VIDEO-WOW` — the product magic: "it made a personalized video pitch page for every hiring manager"

**Hook types (H):**
- `H1-CONTRARIAN` — "Stop applying to jobs. Seriously."
- `H2-RESULT` — "I got 4 interviews in 9 days without submitting one application"
- `H3-SECRET` — "Recruiters don't want you to know this exists"
- `H4-DEMO` — cold-open on the product ("Watch what happens when I upload my resume")
- `H5-QUESTION` — "Why did 300 applications get me nothing?"
- `H6-NEGATIVE` — "Your resume is going straight into a shredder. Here's proof."
- `H7-POV/STORY` — "POV: you got laid off in the worst market in a decade"
- `H8-STAT` — "98% of applications are never seen by a human"

**Formats (F):** `TH` talking-head UGC · `TH-BROLL` talking head + B-roll cutaways · `DEMO` screen-record led · `GREEN` greenscreen-over-dashboard · `STATIC` image ad · `CAR` car-confessional.

**Naming convention** (survives in Meta/TikTok breakdown reports — this is how you find winners):

```
{DATE}_{PERSONA}_{ANGLE}_{HOOK}_{FORMAT}_{AVATAR}_{VER}
e.g.  0713_P1_A1_H2_TH-BROLL_AVsarah_v03
Campaign: PRWL_{PLATFORM}_{OBJECTIVE}_{STAGE}   e.g. PRWL_META_TRIAL_TEST
Ad set:   {AUDIENCE}_{GEO}_{OPT-EVENT}          e.g. BROAD_US_TRIALSTART
```

Test **one variable per batch** (same script, vary hook; same hook, vary avatar). Industry practice: put ~70% of testing budget on **angle** testing first — message beats everything else, then hooks, then avatars/format. Log everything in a sheet keyed on the ad name so you can pivot winners by token.

---

# SECTION B — PAID ADS PLAN

## B1. Meta Ads

### Benchmarks to plan against (2025–2026 data)
- Cross-industry: CPM ~$13–14 (up ~20% YoY), CPC ~$0.78, median CPA ~$38.
- **Employment & job training is a strong Meta vertical: ~11.7% lead CVR** (top 5 of all industries). Education CPA as low as ~$8 — career intent audiences convert.
- Realistic Gigaprowl expectations: **CPM $8–15** (broad, US), **cost per free-trial start $8–25** in testing, settling toward **$10–18** with winning creative. Cost per *paid* subscriber = trial cost ÷ trial→paid rate (industry free-trial conversion runs 15–25%; assume 15%) → **$60–150 CAC** initially. At $49–129/mo that's a 1–3 month payback — workable, and it improves as creative wins compound.

### Funnel decision: web-first, not app-install
Gigaprowl is a Next.js web app on Vercel — run **website conversion campaigns**, not app campaigns. This sidesteps the worst iOS ATT/SKAN pain (75%+ of iOS users opt out of tracking; app campaigns require SKAN/AAK workflows). Notes:
- Implement **Meta Pixel + Conversions API (CAPI)** server-side from day one (you control the backend; target 70%+ event match quality by passing email, name, and click IDs on signup).
- Conversion events: `StartTrial` (primary optimization event), `CompleteRegistration`, `Subscribe` (value passed). Optimize on `StartTrial` until you have volume, then move to `Subscribe`/Purchase optimization once you see ~50 subscribes/week per ad set.
- Send `Subscribe` with value via CAPI at Stripe webhook time — this is what lets Meta find *payers*, not trial tourists (young traffic starts trials and cancels; watch trial→paid by age breakdown).

### Campaign structure: hybrid (2025–2026 consensus)
Manual testing + Advantage+ scaling. ASC/Advantage+ excels at efficient broad delivery but hides which hook won; manual campaigns give you creative-level truth.

```
CAMPAIGN 1 — PRWL_META_TRIAL_TEST (manual, ABO, ~40–50% of budget)
  1 ad set, Broad US 22–55, Advantage+ placements, optimize StartTrial
  6–10 new ads/week from the UGC factory. This is the lab.

CAMPAIGN 2 — PRWL_META_TRIAL_SCALE (Advantage+ Sales/ASC, ~40–50%)
  Only graduated winners (see criteria below). 10–15 proven creatives
  live at once; feed 5+ fresh winners/month.

CAMPAIGN 3 — PRWL_META_RMKT (manual, ~10%)
  Custom audiences: site visitors 30d, video viewers 75%, trial-started-
  not-subscribed. Angle: urgency + social proof + demo depth.
```

**Targeting:** Go broad and let creative do the targeting — your UGC hooks self-select job seekers. Do NOT over-narrow; Meta's employment ads policies (Special Ad Category applies to job *listings*, not job-search *tools*, but expect occasional review friction — appeal quickly and avoid "get hired" guarantees in copy). Useful interest tests for the manual lab only: "job hunting," "LinkedIn," "resume," recently-moved, graduation-age stacks. Lookalikes of subscribers once you have 500+.

**Creative formats:** 80% 9:16 video (UGC factory output), 15% static (meme-style, "text-message" screenshots, before/after dashboards), 5% carousel (step-by-step "how Gigaprowl found me a job"). Always upload 9:16 + 4:5 + 1:1.

### Budget + scaling rules
- **Start $70/day Meta** ($30 test / $30 ASC / $10 remarketing; ASC waits until week 2).
- Learning phase = 50 optimization events per ad set in 7 days. At $10–20/trial, $30/day exits learning in ~2–3 weeks — acceptable while testing; consolidate rather than fragment ad sets.
- **Scale +20% every 3–4 days max** (bigger jumps reset learning; 2026 Andromeda update tightened reset thresholds). Add creative variants before adding ad sets.
- Never touch a scaling ad set more than twice a week.

### Kill / scale criteria (per ad, evaluated after ~$25–30 or 2,000 impressions)
| Signal | Kill | Iterate | Scale |
|---|---|---|---|
| Hook rate (3s views ÷ impressions) | <20% | 20–30% | >30% |
| CTR (link) | <0.8% | 0.8–1.5% | >1.5% |
| Cost per trial start | >$35 | $20–35 | <$20 |
| Trial→paid (7-day view) | <8% | 8–15% | >15% |

Graduate to ASC: ≥5 trials at <$25 each AND hook rate >25%. Kill in ASC: 7-day CAC >2× target for 2 consecutive checks.

## B2. TikTok Ads

### Why TikTok is arguably better for Gigaprowl
CareerTok/LayoffTok is a massive organic category; job-hunt content is native to the platform. Benchmarks: **global median CPI $1.72** (app campaigns); **Spark Ads deliver ~$1.41 median CPI vs $1.93 for standard in-feed (-27%) and a 33% higher click-to-install rate**; DTC median CPA $15.80 (top quartile <$9.40). For a web-trial funnel, expect **cost per trial $6–20** — often cheaper than Meta, with faster creative burn-out.

### Spark Ads plan (primary format)
1. Create a **Gigaprowl TikTok account** and post the UGC-factory videos organically (2–3/day). Also seed 3–5 micro-creators ($100–200/post or via Icon.com human ads, ~$66/ad) with usage rights.
2. Boost the best organic posts as **Spark Ads** (creator/brand grants a video code in-app; ad runs from the real account — 30% higher completion, 142% higher engagement vs standard in-feed). Caption is locked to the organic post, max 4 display lines — write captions ad-ready.
3. Standard in-feed ads as overflow for factory variants that don't get posted organically.

**Creative specs:** 9:16, 1080×1920, .mp4, 10–25s sweet spot, hook in first 1–2s (no brand intro), captions burned in. Safe zones: keep ~130px top, 440px bottom, 44px right clear. Refresh creative every 7–14 days — TikTok burns creative 2–3× faster than Meta.

**Structure:** 1 campaign (Website Conversions → trial start, TikTok Pixel + Events API), 2 ad groups (Broad US 22–40; Broad US 25–55), **5–7 active creatives per ad group** (22% lower CPI vs <3 creatives). Start **$30–50/day.** Same kill/scale logic; evaluate faster (48h).

## B3. First-Month Week-by-Week Test Plan (~$100/day blended, ≈$3,000)

| Week | Meta | TikTok | Creative factory | Goals / gates |
|---|---|---|---|---|
| **1** | $50/day, TEST campaign only. 12 ads: 4 angles × 3 hooks, broad. Pixel+CAPI verified, event match >70% | $0 — post organics 3/day, open pixel/Events API | Batch 1: 40 variants; build B-roll library | 100+ trials signal? Identify 2 winning angles. Kill anything failing table B1. |
| **2** | $70/day: keep TEST $40, launch ASC $30 with wk-1 winners | $30/day Spark on top 3 organics + 1 in-feed ad group (6 creatives) | Batch 2: 60 variants concentrated on wk-1 winning angles; new hooks on losers | Cost/trial <$25 on ≥3 ads. First trial→paid data. |
| **3** | $80/day; scale ASC +20% if CAC holds; refresh TEST with batch 3 | $40/day; add 2nd ad group; commission 5 real-creator Spark posts | Batch 3: 60 variants; start avatar/format tests on locked winning angle+hook | Blended cost/trial <$20. 300–500 cumulative trials. |
| **4** | $100/day; launch remarketing; test Subscribe-optimized ad set if ≥50 subs | $50/day; Spark winners scaled +20%/3 days | Batch 4: iterate; brief Icon.com human shoots of top 2 scripts | ≥600–1,000 trials, ≥90–150 paid, blended CAC <$120. Decide month-2 budget (2–3× if CAC < 1.5-month payback). |

**Month-1 exit math:** ~$3,000 spend ÷ ~$15 blended trial ≈ 200–400 trials/platform → with 15% trial→paid, ~60–120 paying users + organic/TikTok halo. To hit 10k users fast, "users" = free-trial signups: at scaled $500–1,000/day (month 2–3) and $12 blended cost/trial, that's **~2,500 trials/month per $30k** — 10k signups in ~2–3 months of aggressive scaling, funded by improving CAC.

---

# SECTION C — COLD EMAIL AT SCALE (Smartlead)

## ⚠️ C0. Compliance reality check — read first
Cold-emailing **consumers at personal addresses is legally different from B2B**:
- **US (CAN-SPAM):** legal without prior consent, B2B or B2C, IF you: (1) no deceptive subject/headers, (2) include a physical postal address, (3) honor opt-outs within 10 days with a working one-click unsubscribe, (4) identify the message as an ad where required. Violations run up to **$53,088 per email** — this is per email, so list hygiene matters.
- **EU/UK/Canada (GDPR + ePrivacy / CASL):** **B2C cold email to personal addresses requires prior consent. Do not send. Geo-fence the program to US-only leads**, and suppress any .eu/.uk-resident records even with gmail.com addresses (check location fields). "Legitimate interest" arguments effectively fail for personal inboxes.
- **Gmail/Microsoft bulk-sender rules (2024–2025, enforced hard since Nov 2025):** SPF+DKIM+DMARC mandatory, one-click unsubscribe (List-Unsubscribe header) mandatory, spam complaints <0.1% working ceiling / 0.3% = permanent rejections. B2C job seekers on Gmail = you are sending Gmail-to-Gmail at Gmail's most protected surface. Keep volume conservative and quality high.
- **Platform ToS:** LinkedIn scraping via PhantomBuster violates LinkedIn ToS (account-ban risk — use a seat you can afford to lose, stay under PhantomBuster's safety limits). Apollo permits personal-email prospecting in-product (toggle "personal" as primary email type) — that's the cleaner sourcing path.
- **Positioning saves you:** these are people *publicly asking to be contacted about jobs* (#OpenToWork, layoff lists = opt-in-to-visibility lists). Outreach that reads as genuinely helpful ("I found 3 roles + the hiring managers for you") gets low complaint rates. Outreach that reads as spam selling a $49 subscription gets you burned. Lead with value, sell on the reply.

## C1. Infrastructure (Smartlead Unlimited Smart, $174/mo)

Target: **~9,000 sends/month in month 1, ~30,000/month by month 3.**

| Component | Spec | Notes |
|---|---|---|
| **Domains** | Start **10** look-alike domains (e.g. getgigaprowl.co, trygigaprowl.com, gigaprowlapp.io, gigaprowlhq.com, joingigaprowl.com, gigaprowl-jobs.com …). Never send cold from gigaprowl.com | ~$120/yr total. Buy 10 more at month 2. |
| **Mailboxes/domain** | **2–3 max** (Google Workspace, $6–7/seat) | 10 domains × 3 = **30 inboxes**, ~$200/mo. Alternatively Smartlead pre-warmed inboxes to start faster. |
| **Auth** | SPF, DKIM, DMARC (start p=none → p=quarantine at day 30), custom tracking domain per sending domain, List-Unsubscribe header ON | Non-negotiable per Gmail/Microsoft 2025 rules. |
| **Warmup** | **30 days minimum** before campaign sends (or buy pre-warmed). Smartlead warmup stays ON forever — teams that stop see deliverability erode in 6–8 weeks | Ramp: wk1 5–10/day, wk2 15–20, wk3 25–30, wk4 35–40 warm+cold blended. |
| **Sending cap** | **20–30 cold/day per inbox** (limit is per inbox incl. warmup; 20–49/day band shows best reply rates; >40 to Gmail degrades placement) | 30 inboxes × 25/day = **750/day ≈ 15k/month** capacity at steady state. |
| **Hygiene** | Verify every list (Smartlead built-in or MillionVerifier); bounce <2%; spam complaint <0.1%; rotate inboxes (Smartlead auto); plain-text emails, no images/links in email #1 | One link max (in email 2+), to the personalized pitch page. |

Month-1 realistic volume while warming: ~300/day by week 4. **Start domain purchase + warmup on day 1** — it's the long pole.

## C2. Lead Sourcing (US-only, job seekers actively signaling)

| Source | How | Volume | Notes |
|---|---|---|---|
| **LinkedIn #OpenToWork** | PhantomBuster **LinkedIn Search Export** (filter: "open to work" badge, US, target titles) → chain **LinkedIn Profile Scraper** (extracts 70+ fields incl. the OpenToWork flag) → enrich emails via Apollo people-match | ~80–150 profiles/day per LinkedIn seat (stay under safety limits) | Highest-intent public signal. Use burner-ish seat + residential proxy. |
| **Apollo directly** | People search with **personal email** as primary email type; filters: US, titles you serve, "open to new opportunities" signals, recently-departed (job change gap) | Thousands; 1 credit/contact | Cleanest ToS path. Cross-reference with OpenToWork list for intent. |
| **layoffs.fyi layoff lists** | Crowdsourced spreadsheets of laid-off employees *who opted in to be visible to recruiters* — free with attribution. Pull names/companies → Apollo enrich for personal emails | Bursty; thousands per big layoff event | **Best list quality**: explicit "please contact me about jobs" intent. Also mirror: WARN act filings, Airtable layoff lists per company. |
| **New-grad lists** | University career-fair public lists, GitHub "new grad 2026" repos (SimplifyJobs etc.) contributors, Discord/communities — collect via opt-in lead magnet instead of scraping where possible | Moderate | Younger = Gmail-heavy, lower $ conversion; deprioritize for cold email, target via TikTok instead. |
| **Gigaprowl's own free tier** | Anyone who uploads a resume but doesn't convert = warm email list (this is consented marketing email, not cold) | Compounds | Your best "cold" channel is actually this lifecycle list — build it aggressively. |

Dedupe across sources, enrich each lead with: `first_name, current/last title, last company, layoff_event (if any), top job match Gigaprowl found, hiring_manager_name at that company`. That last field powers the killer personalization.

## C3. The Sequence — "we already made your pitch video"

The trick: **run each lead through Gigaprowl's own pipeline before emailing** (resume-less mode: title + company + LinkedIn → find 3 matching live roles + a hiring manager). The email demonstrates the product instead of describing it. Personalized video/page links lift replies 2–4×; keep videos <60s.

**Email 1 — Day 0 (plain text, no links, no images):**
> **Subject:** `{{first_name}} — 3 roles at {{company_1}}, {{company_2}} + the hiring managers`
>
> Hi {{first_name}} — saw you're open to new roles after {{last_company}}.
>
> I ran your background through Gigaprowl (I'm the founder) and it found 3 live openings that match your {{specialty}} experience — including a {{job_title_1}} at {{company_1}}, where the hiring manager is {{hm_first_name}}.
>
> It also drafted a 40-second personalized video pitch from you to {{hm_first_name}} — the kind of thing that skips the ATS pile entirely.
>
> Want me to send the link so you can see it? (Free — no card.)
>
> — {{sender_name}}, Gigaprowl
> {{postal_address}} · reply "no" and I won't email again

**Email 2 — Day 3 (the payoff, 1 link):**
> **Subject:** `re: your pitch video for {{company_1}}`
>
> Here it is: {{pitch_page_url}}
>
> That page has your AI pitch video, the 3 matched roles, and {{hm_first_name}}'s profile. You can regenerate the video with your own resume in ~2 minutes — the trial's free.
>
> One thing worth knowing: {{company_1}} posted that role {{days_ago}} days ago and roles like it close in ~3 weeks. Worth a look this week.

**Email 3 — Day 7 (breakup + proof):**
> **Subject:** `closing your Gigaprowl matches`
>
> I'll stop here — but before I archive your matches: last month Gigaprowl users landed interviews at {{proof_companies}} by pitching hiring managers directly instead of applying cold. Average: first interview request in 11 days.
>
> Your 3 matches (and the video) stay live for 7 more days: {{pitch_page_url}}
>
> Either way — good luck out there, the market's brutal. Unsubscribe: {{unsubscribe_link}}

Rules: 3 touches max, then suppress forever. Personalize ≥3 fields per email (advanced personalization ≈ 2× replies, up to ~18% vs ~9% generic; +142% vs blasts). Send Tue–Thu 8–11am recipient time. Rotate 3 subject/opening variants per step and let Smartlead A/Z test.

## C4. Benchmarks & Expected Yield

| Metric | Conservative | Good (this level of personalization + intent) |
|---|---|---|
| Deliverability (inbox placement) | 80% | 95% |
| Reply rate | 4% (2025–26 avg is 3.4–5%) | 8–15% (video/personalized campaigns hit 2–4× baseline; laid-off audiences *want* this email) |
| Positive reply → trial signup | 40% | 60% |
| Click → trial (from email 2 pitch page, non-repliers) | 3% | 8% |
| **Trials per 1,000 sends** | ~25 | ~70 |
| Trial→paid | 12% | 20% |

At month-3 steady state (30 inboxes, ~15k sends/mo): **~375–1,000 trials/month, ~50–200 paid**, at a cost of ~$600/mo infra (Smartlead + inboxes + domains + Apollo credits) → **CAC $5–15/trial** — likely your cheapest channel, but capped by volume; paid ads remain the scale engine. Kill criteria: pause any inbox with bounce >3% or complaint >0.1%; pause any sequence variant with reply <2% after 500 sends.

---

## Channel Summary & Budget (Month 1)

| Channel | Month-1 cost | Expected trials | Role |
|---|---|---|---|
| Meta ads | ~$2,100 | 150–300 | Scale engine, best signal quality |
| TikTok ads | ~$900 | 100–250 | Cheapest reach, Spark authenticity, organic halo |
| UGC factory | ~$1,000 (HeyGen API + Creatify + Veo + creators) | fuels both | 50–100 variants/week |
| Cold email | ~$600 (Smartlead $174 + 30 inboxes + 10 domains + Apollo) | 100–250 (ramping) | Highest-intent, lowest CAC, capped volume |
| **Total** | **≈$4,600** | **350–800 trials** | Scale winners 2–3×/month toward 10k |

### Sources
- [Arcads pricing (eesel)](https://www.eesel.ai/blog/arcads-ai-pricing) · [Arcads review (Marketer Milk)](https://www.marketermilk.com/blog/arcads-review) · [HeyGen API pricing](https://www.heygen.com/api-pricing) · [HeyGen pricing explained](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained) · [Creatify pricing](https://creatify.ai/pricing) · [MakeUGC pricing](https://makeugc.ai/pricing) · [Icon pricing](https://icon.com/pricing) · [Icon review (Airpost)](https://www.airpost.ai/blog/icon-ai-admaker-review)
- [AI video API pricing — Sora 2/Veo 3.1](https://www.buildmvpfast.com/api-costs/ai-video) · [Veo 3 pricing 2026](https://www.veo3ai.io/blog/veo-3-pricing-2026) · [CapCut API status (json2video)](https://json2video.com/how-to/capcut-api/) · [CapCutAPI (GitHub)](https://github.com/ashreo/CapCutAPI) · [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- [Meta benchmarks (WordStream 2025)](https://www.wordstream.com/blog/facebook-ads-benchmarks-2025) · [Meta benchmarks 2026 (Enrich Labs)](https://www.enrichlabs.ai/blog/meta-ads-benchmarks-2025) · [ASC vs manual (Linkrunner)](https://linkrunner.io/blog/meta-advantage-shopping-vs-manual-campaigns-for-app-growth-when-to-use-each) · [ASC guide (bir.ch)](https://bir.ch/blog/advantage-plus-sales-campaigns-guide) · [Learning phase & 20% rule (Niblin)](https://niblin.com/blog/meta-ads-learning-phase) · [iOS ATT retrospective](https://adlibrary.com/posts/ios-14-att) · [RevenueCat Meta ads for subscription apps](https://www.revenuecat.com/webinars/advanced-meta-ads-strategies-for-subscription-apps/)
- [TikTok benchmarks (AdBacklog)](https://adbacklog.com/blog/tiktok-ads-benchmarks-per-industry-2025) · [TikTok CPI/Spark data (Benly)](https://benly.ai/learn/tiktok-ads/tiktok-ads-cost-benchmarks) · [TikTok ad specs (AdManage)](https://admanage.ai/blog/tiktok-ad-specs) · [Triple Whale TikTok benchmarks](https://www.triplewhale.com/blog/tiktok-benchmarks)
- [Ad naming conventions (AdManage)](https://admanage.ai/blog/ad-creative-naming-conventions) · [UGC testing structure (Elite Brands)](https://www.elitebrands.org/blog/deep-dive-structuring-ugc-testing-for-meta-ads-creative-strategy)
- [Smartlead warmup guide](https://www.smartlead.ai/blog/email-warm-up-guide) · [Smartlead sending frequency](https://www.smartlead.ai/blog/email-frequency-best-practices-for-cold-emails) · [Smartlead pricing](https://www.smartlead.ai/pricing) · [Daily limits (Mailreach)](https://www.mailreach.co/blog/how-many-cold-emails-to-send-per-day) · [Cold email legality (Overloop)](https://overloop.com/blog/cold-email-illegal) · [GDPR/CAN-SPAM (Instantly)](https://instantly.ai/blog/b2b-email-list-compliance-gdpr-canspam/) · [Reply benchmarks (Instantly)](https://instantly.ai/blog/cold-email-reply-rate-benchmarks/) · [Video email replies (Sendspark)](https://blog.sendspark.com/cold-email-vs-video-email-replies)
- [PhantomBuster LinkedIn Search Export](https://phantombuster.com/automations/linkedin/3149/linkedin-search-export) · [Apollo personal emails](https://knowledge.apollo.io/hc/en-us/articles/6217107598861-Prospect-with-Personal-and-Business-Emails) · [layoffs.fyi](https://layoffs.fyi/)
