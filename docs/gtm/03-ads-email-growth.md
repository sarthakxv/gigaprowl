# Gigaprowl — Paid Acquisition + Outbound Email Growth Plan

**Doc:** 03-ads-email-growth.md · **Product:** Gigaprowl (prowl-livid.vercel.app) — AI job-hunting copilot (resume upload → AI job matching → hiring-manager discovery → personalized pitch pages + AI avatar videos + outreach cadences)
**Pricing:** Free (5 hunts) · Plus $19/mo · Max $49/mo
**ICP:** Job seekers 20–35, tech/white-collar, US-first
**Goal:** 10,000 users → 100,000 users
**Last updated:** July 2026

---

## 0. TL;DR

- **Meta is the volume engine, TikTok is the culture engine.** Career/employment is one of the cheapest verticals on Meta (~$0.86 CPC, ~$17 CPL) and TikTok is where the ICP literally lives — 66% of Gen Z uses TikTok for career advice and 46% have landed a job/internship via TikTok.
- **Creative is the targeting now.** Detailed targeting is being consolidated (June 2025 changes); win with 50–100 AI-UGC ad variants/week at $1.50–$11/video, not with interest-stack micromanagement.
- **Cold email to consumers is legally narrow.** CAN-SPAM (US) permits it with opt-out + physical address; GDPR/ePrivacy (EU/UK) effectively bans B2C cold email. Run US-only, low volume, high personalization — treat it as a scalpel, not a firehose.
- **North star funnel:** Visit → Signup → Resume upload → First hunt → Paid. Everything below reports into these five numbers.

---

## 1. META ADS PLAN

### 1.1 Campaign structure: manual first, ASC when signal exists

Meta renamed Advantage+ Shopping to **Advantage+ Sales** in 2025 and it now supports lead gen and app-signup objectives. But ASC needs ~50 conversions/week to train — at a $15–25 CPA that's $750–$1,250/week minimum. Independent data also shows ASC CAC can balloon at low budgets while manual stays stable.

**Phase 1 — Testing (< $1,500/mo): manual campaigns.**

```
CAMPAIGN 1: PROSPECTING-TEST (ABO, $20–60/day)
  Ad set A: Broad 20–35 US, Advantage+ audience ON (suggestion: job-search interests)
  Ad set B: Interest stack "Career changers"
  Ad set C: Interest stack "Active job seekers"
  → Optimize for SIGNUP (pixel event), not clicks. If signup volume is thin,
    optimize for "CompleteRegistration" then migrate to "ResumeUploaded"
    custom conversion once you get 50+/week.

CAMPAIGN 2: RETARGETING (CBO, $5–10/day)
  Website visitors 30d + video viewers 95% + engaged IG/FB 90d, excl. signups
```

**Phase 2 — Scale (> $3–5k/mo): add ASC.**
- 1 Advantage+ Sales campaign holding proven winners (60–70% of budget)
- 1 manual ABO test campaign feeding it new creative weekly (20–30%)
- 1 retargeting campaign (10%)
- Feed ASC a *diverse* creative library (10+ live ads across formats) — with ASC, creative diversity IS the targeting.

**Conversion event ladder:** PageView → SignUp → ResumeUploaded → HuntStarted → Subscribe. Optimize for the deepest event that still gets ~50/week. Pass Subscribe value ($19/$49) for value-based optimization later.

### 1.2 Audiences

Note: Meta consolidated/removed many detailed interests in June 2025 and killed audience exclusions on boosted posts; expect interest options to keep shrinking. Structure accordingly — broad + creative does the work.

**Interest stacks (Phase 1 testing):**

| Stack | Interests (OR within stack) | Layer |
|---|---|---|
| Active job seekers | Job hunting, Résumé, Employment website, Indeed, LinkedIn, Glassdoor, ZipRecruiter | Age 20–35, US |
| Career changers / upskillers | Career development, Professional development, Coursera, Udemy, General Assembly, Bootcamps | Age 22–35 |
| Tech workers | Software engineering, Product management, Information technology, Computer science, GitHub, Stack Overflow | Age 22–35 |
| New grads | Recently moved, College graduate behaviors, university interests | Age 20–27 |
| Hustle/anxiety adjacent | Side hustles, Personal finance, "quiet quitting"-adjacent creators' audiences via engagement LALs | Age 20–35 |

**Custom audiences (build from day 1):**
- Website visitors 30/90/180d (180d max window recommended)
- Video viewers 25%/75% at 365d (resilient to iOS tracking loss)
- IG/FB page engagers 90d
- Customer lists: all signups; resume-uploaders; paid subscribers (upload emails, refresh weekly)

**Lookalikes:** Build 1% and 1–3% LAL from *paid subscribers* once you have ~1,000 (quality source beats big source — 1,000 buyers outperforms 50,000 visitors). Before that, LAL from resume-uploaders. In 2025–26 practice, uploading the customer list into an ASC/Advantage+ campaign often beats explicit LALs since Meta does lookalike modeling internally — test both, expect broad+list-seed to win.

**Retargeting messaging by stage:**
- Visited, no signup → "Your first 5 hunts are free" + demo creative
- Signed up, no resume → "Upload your resume — 60 seconds to your first match" (also do this via email/push, cheaper)
- Uploaded, no hunt / free users → upgrade creative: "Your next hunt found 3 hiring managers. Unlock outreach on Plus."

### 1.3 Creative formats that win (2025–26 B2C SaaS)

UGC-style/lo-fi ads get ~4x engagement and ~2.8x conversion vs polished brand creative; 42% of top-spending ads are now lo-fi. AppsFlyer's 2025 analysis (1.1M creatives, $2.4B spend) found **tutorial/demo formats drive 45% higher installs-per-mille and 17% better D7 retention than testimonial UGC** — and the 2020-era "ring-light testimonial" is fatigued. Ranked for Gigaprowl:

1. **Screen-recording demo with voiceover (highest priority).** Raw capture of: resume upload → matches appear → hiring manager identified → AI video generates. The product IS the wow. 15–30s, 9:16 and 4:5, big captions.
2. **UGC talking head → screen demo splice.** 3–5s face hook ("I didn't apply to a single job last month…") then cut to screen recording. Creator or AI avatar.
3. **"Results" reaction format.** Creator reacts to their Gigaprowl pitch page / AI avatar video of themselves: "an AI made this video of me pitching to a hiring manager??"
4. **Meme statics / screenshot statics.** Tweet-style screenshots, "applying to 200 jobs vs 1 Gigaprowl hunt" comparison memes, Notes-app screenshots. Dirt cheap, great for retargeting and CTR harvesting.
5. **Us-vs-them comparison.** Split screen: "Cold applying on Indeed (200 apps, 2 replies)" vs "Gigaprowl (5 hunts, direct line to hiring managers)."
6. **Founder/authority talking head.** "We built Gigaprowl because the apply button is broken." Works in retargeting.

Specs: 9:16 primary + 4:5 for feed, hook in first 2s, captions always-on, sound-on design (sound-on creative converts ~28% better on short-form), CTA by second 10.

### 1.4 Hook library (first 3 seconds)

**Pain hooks**
- "I applied to 300 jobs and got 2 interviews. Then I stopped applying."
- "The 'Easy Apply' button is a scam. Here's what actually works."
- "Recruiters spend 6 seconds on your resume. Hiring managers reply to pitches."
- "POV: it's month 4 of your job search and Indeed has ghosted you again."

**Curiosity / demo hooks**
- "This AI found the hiring manager for every job that matches my resume."
- "I uploaded my resume and an AI made a video of me pitching to a hiring manager."
- "There's an AI that hunts jobs for you while you sleep. Watch."
- "Rate my job hunt: 1 upload, 12 matches, 4 hiring managers found, 1 interview."

**Social proof / outcome hooks**
- "How my friend got 4 interviews in 2 weeks without submitting one application."
- "Laid off in March. Hired in May. This is the tool I used."

**Contrarian hooks**
- "Stop applying to jobs. Seriously. Pitch humans instead."
- "Job boards make money when you STAY unemployed. Think about it."

### 1.5 Budget ramp

| Stage | Daily | Structure | Rules |
|---|---|---|---|
| Week 1–2 | $20–40/day | 1 ABO test campaign, 2–3 ad sets, 3–4 ads each | Optimize for SignUp. Kill ad at $15 spend with 0 signups or CTR <0.8%; kill ad set at 3× target CPA with 0 conversions |
| Week 3–4 | $50–80/day | Winners → consolidated CBO; keep ABO testing lane | Scale budget max +20%/edit every 48–72h (bigger jumps reset learning phase) |
| Month 2 | $100–150/day | Add retargeting; consider ASC if ≥50 conv/week in reach | Duplicate winners into ASC rather than editing live |
| Month 3+ | $200+/day | ASC core + ABO test lane + retargeting | Refresh creative weekly; top concepts fatigue in 2–4 weeks |

Honest caveat: at $20/day you won't exit learning phase — that's fine. Weeks 1–2 are a *creative CTR/CPC/hook-rate tournament*, not a CPA readout. Judge CPA only from week 3 at ≥$50/day.

### 1.6 Benchmarks (career vertical, 2025 data)

| Metric | Benchmark | Gigaprowl target |
|---|---|---|
| CPC (Career & Employment) | ~$0.86 (among cheapest verticals) | <$1.20 |
| CTR | ~1.5–2%+ (career CTR rose 34% YoY) | >1.5% |
| CPL / cost per signup | ~$17.64 industry avg | $5–12 (free product, low friction) |
| CPI if app campaigns | $3–15 for productivity-type apps | $4–8 |
| Cost per resume upload | — | $10–20 |
| Cost per paid sub (blended) | — | <$60 Plus / <$120 Max (≈2–3 mo payback) |
| Signup→paid | B2C freemium ~5–9% | 6%+ |

Warning baked into 2025 data: career-vertical conversion rates fell ~37% YoY — clicks are cheap, conversions are the battle. Landing page + activation speed matter more than the ad.

### 1.7 Two-week test matrix (5 concepts × 3 hooks = 15 ads)

Budget: $30–40/day, ABO, 1 broad ad set + 1 job-seeker stack. All 9:16 video except E.

| Concept | Hook 1 (pain) | Hook 2 (curiosity) | Hook 3 (proof/contrarian) |
|---|---|---|---|
| A. Screen demo (upload→matches→managers) | "300 applications, 2 interviews. Then I stopped applying." | "This AI finds the hiring manager for every matching job." | "Stop applying to jobs. Pitch humans instead." |
| B. UGC talking head → demo splice | "Month 4 of the job hunt and Indeed ghosted me again." | "I let an AI run my job search for a week. Results:" | "My friend got 4 interviews without one application." |
| C. AI-avatar reaction to pitch video | "Nobody reads your resume. They watch this instead." | "An AI made a video of ME pitching a hiring manager." | "Hiring managers replied to this in 24 hours." |
| D. Us-vs-them split screen | "Easy Apply is where resumes go to die." | "200 cold apps vs 1 Gigaprowl hunt — watch." | "Job boards profit when you stay unemployed." |
| E. Meme/tweet static | "the job market is a group project and everyone else is dead weight" | Screenshot: "gigaprowl found my hiring manager's name in 40 seconds" | "unemployed → employed speedrun (real)" |

**Cadence:** Days 1–4 all 15 live, kill bottom ⅓ on hook rate (3s views/impr <25%) + CTR. Days 5–9 kill to top 5 on cost-per-signup. Days 10–14 take top 2 concepts, spin 3 new hooks each (matrix v2). Ship winners to the scale campaign. Decision metric order: hook rate → CTR → CPSignup → cost-per-resume-upload.

---

## 2. TIKTOK ADS PLAN

### 2.1 Why TikTok is arguably channel #1 for Gigaprowl

- #CareerTok has 2B+ views; 66% of Gen Z uses TikTok for career advice; **46% of Gen Z have landed a job or internship via TikTok**; 54% of tech professionals use it for job advice.
- Top hashtags to ride: #jobsearch, #resumetips, #careertok, #interviewtips, #jobtok, #layoffs, #opentowork.
- The ICP (20–35 white-collar) is *actively consuming job-search content* here — intent + attention in one place.

### 2.2 Structure: Spark Ads on seeded creator posts + Smart+

**Track 1 — Creator seeding → Spark Ads (the core motion).**
1. Recruit 10–20 micro creators/month in #careertok / #jobtok (10K–50K followers; native video runs $200–800; nano creators $100–500).
2. Brief: "Document your real job hunt using Gigaprowl" — organic-feel post on THEIR account.
3. Buy Spark authorization for the 2–3 posts that get organic traction (30-day Spark rights typically $300–$1,000 or +15–25% on base rate; get 60-day auth codes in the contract).
4. Run as Spark Ads. Why it works: Spark eCPM ~$3.54 vs $4.73 platform average; Spark converts ~2.6% vs 1.8% for studio in-feed (+44%); posts with 500+ prior organic engagements see ~52% lower CPC than fresh posts. **Boost proven posts, not cold uploads.**
5. Expect only 3–5% of seeded creators to produce ad-grade content — seed in volume, whitelist the hits.

**Track 2 — Smart+ campaigns (TikTok's Advantage+ equivalent).**
Smart+ went from 9% to 42% of TikTok performance spend in three quarters (Tinuiti Q3 2025) — it's the default now. You supply creatives + goal + budget; it handles targeting/bidding. It beats manual **when creative supply is strong and web events fire correctly** (TikTok Pixel + Events API, optimize to SignUp → ResumeUploaded ladder as on Meta). Run Smart+ Web Campaign as the always-on engine; keep one manual campaign as a creative test lane.

### 2.3 Creative specs & rules

- 9:16, 1080×1920, 15–34s sweet spot, hook <2s, captions on, design for sound-on
- Must look native: shot-on-phone feel, trending audio where licensed (licensed-music creative outperforms branded audio ~18% on hold rate), creator voiceover
- Refresh every 7–10 days once spending >$1k/wk — TikTok fatigues creative faster than Meta
- Minimum 3–5 new creatives/week into Smart+; recycle Meta winners reformatted with TikTok-native captions/audio

### 2.4 Benchmarks

| Metric | TikTok 2025–26 |
|---|---|
| CPM | $4–12 (Spark eCPM ~$3.54) |
| CPC | ~$1.02 in-feed avg; Spark ~$1.41 but converts better |
| CVR | 1.8% in-feed; 2.6% Spark |
| Cost per signup target | $4–10 (often below Meta for 20–30 y/o) |
| Creator cost | $200–800/video micro; +$300–1,000 Spark rights |

### 2.5 TikTok budget plan

| Month | Spend | Allocation |
|---|---|---|
| 1 | $500–800 | $300–500 creator seeding (3–5 creators), $200–300 Spark boosts on best 1–2 posts |
| 2 | $1,500 | $600 seeding (5–8 creators), $900 Spark + Smart+ ($30/day) |
| 3+ | $3,000+ | 40% seeding/rights, 60% Smart+ scaling winners; Smart+ needs ~50 conversions/week to hum, so consolidate — don't fragment |

$0-budget variant: post 1 organic TikTok/day from a Gigaprowl brand account (screen demos, job-market reactions, "hunt of the day"). CareerTok organic reach is genuinely attainable and it builds the engagement audiences you'll retarget later.

---

## 3. AI UGC MASS-PRODUCTION PIPELINE

### 3.1 Tool comparison (2025–26 pricing)

| Tool | Price | Effective cost/video | Best for | Notes |
|---|---|---|---|---|
| **Arcads.ai** | ~$110/mo (≈10 videos); ~$220/mo Creator | ~$11 | Highest-realism AI UGC actors, ad-specific | The quality benchmark; pricing gated behind signup |
| **HeyGen** | $29–89/mo | ~$1.50–3 | Avatar talking heads at volume | You already use HeyGen in-product — reuse the pipeline for ads. "Unlimited" caveat: avatar renders burn ~20 credits/min, so $29 ≈ ~30 min avatar video/mo |
| **Creatify** | $19–49/mo | ~$2–5 | URL→ad generation, batch variants | ~85–90% of Arcads quality at 60–70% of price; great volume workhorse |
| **Captions.ai** | ~$10–25/mo tiers | ~$1–3 | AI Ad Generator + best-in-class captions/edits | Use as both generator and post-processor for creator footage |
| **MakeUGC** | $29/mo (~10 videos) | ~$3 | Cheap simple UGC ads | ~75% cheaper than Arcads for same count |
| **Icon.com** | $39/mo core; $999 for 6 human UGC ads | flat | All-in-one "Admaker": research, scripts, gen, variants | Also a bridge to real human UGC when AI plateaus |

vs human creators at $50–500+/video, AI UGC runs $2–20/video — a 10–50x cost advantage for testing.

**Recommended stack for Gigaprowl:** HeyGen (already integrated — near-zero marginal cost for avatar hooks) + Creatify ($49 Pro, volume variants) + Captions.ai (editing/captions/repurposing) = **<$150/mo for 50–100 videos**. Add Arcads at $110/mo once spending >$3k/mo on ads and hook realism becomes the bottleneck. Graduate winning AI concepts to real creators via Icon's $999 human-UGC pack or direct micro-creator briefs.

### 3.2 Producing 50–100 ad variants/week

The trick: **you don't make 100 videos, you make 5 bodies and 60+ hooks.** An ad = HOOK (0–3s) + BODY (3–20s) + CTA (20–30s). Bodies are stable; hooks are the variable.

**Weekly assembly line (~6–8 hrs/wk, one person):**
1. **Mon — Script (1 hr):** Pick 5 concepts from the matrix (§1.7). Write 12 hooks per concept with an LLM using the hook-template bank below → 60 hook scripts. Human-edit for voice.
2. **Tue — Generate (2 hrs):** Batch-render hooks in HeyGen/Creatify across 3–4 different avatars/actors (same words, different face = different ad; faces fatigue independently). Record 2–3 fresh product screen-capture bodies (product UI changes weekly anyway).
3. **Wed — Assemble (2 hrs):** In Captions.ai/CapCut templates: hook + body + CTA end-card. Auto-captions, 9:16 + 4:5 exports. → 50–100 finished variants.
4. **Thu — Launch (1 hr):** Upload via bulk sheet with naming convention. 15–20 to Meta test lane, 10–15 to TikTok Smart+, rest banked.
5. **Fri — Read (1 hr):** Hook-rate/CTR/CPSignup readout → winners inform next Monday's scripts.

**Hook/script templating (fill-in-the-blank bank):**
- Pain: "I [painful job-search behavior] and got [bad result]. Then I [switched]."
- Discovery: "There's an AI that [magic outcome] — watch what happens when I [action]."
- POV: "POV: [relatable job-search misery moment]."
- Proof: "[Timeframe] ago I was [before state]. Today I [after state]. Here's the tool."
- Contrarian: "Stop [conventional advice]. Do [Gigaprowl behavior] instead."
- Body template: problem line → "here's how Gigaprowl works" → 3-beat demo (upload / matches+managers / pitch page+video) → outcome line.
- CTA bank: "First 5 hunts are free" / "Upload your resume, see your matches in 60 seconds" / "Link in bio — free to start."

### 3.3 Naming + testing workflow

**Naming convention (every asset, every platform):**
```
[concept]_[format]_[hook-code]_[actor]_[ratio]_[version]_[date]
e.g. DEMO_SCR_PAIN300APPS_AVA-M1_916_V2_260713
     UGC-SPLICE_VID_CURIO-AIVIDEO_ARC-F2_45_V1_260713
```
Concept / format / hook / actor / version each become a filterable column in reporting — you can then answer "do PAIN hooks beat CURIO hooks across all concepts?" in one pivot.

**Testing rules:**
- One variable per comparison (same body+CTA, different hooks — or same hook, different actors)
- Meta: kill at $15 spend & 0 signups or hook-rate <25%; TikTok: kill at 2,500 impressions with CTR <0.8%
- Promote: any ad ≤ target CPSignup for 3+ days → duplicate into scale campaign (never edit the test original)
- Log every ad in a tracker sheet: name, launch date, spend, hook rate, CTR, CPSignup, verdict (kill/iterate/scale)
- Iterate winners on one axis/week: new actor → new first line → new CTA — before retiring
- Expect a 1-in-10 to 1-in-20 hit rate; the volume pipeline exists precisely because of this

---

## 4. COLD EMAIL AT SCALE (Smartlead)

### 4.0 Read this first — the B2C legal reality

- **US (CAN-SPAM):** opt-out regime. Unsolicited commercial email to consumers is legal IF: accurate From/subject, physical postal address in footer, working one-click unsubscribe honored within 10 days, no deceptive headers. Fines up to ~$53k *per email* for violations — the footer requirements are non-negotiable.
- **EU/UK (GDPR + ePrivacy):** B2C cold email to individuals **requires prior consent, no exceptions**. The B2B "legitimate interest" carve-out does not apply to consumers. **Do not send to EU/UK residents. US-only list, filter by location.**
- **Canada (CASL):** consent-based, treat like the EU. Exclude.
- **LinkedIn scraping:** public-data scraping is not criminal in the US (hiQ v. LinkedIn), but it violates LinkedIn's ToS — practical risk is your LinkedIn account getting banned (PhantomBuster, Apollo have all been restricted at times). Use burner/secondary LinkedIn accounts for Phantoms, never the founder account. GDPR/CCPA still govern how you store the data; honor deletion requests.
- **Personal-email caveat:** you'll often be mailing gmail.com addresses. Gmail's bulk-sender rules (spam-rate <0.3%, one-click unsub) apply and consumer inboxes report spam more readily than work inboxes. This channel is capped by physics — treat it as a 5–10k-emails/mo precision channel, not a 100k blaster. Given Gigaprowl actually *helps* the recipient get hired, a genuinely useful, personalized email can clear the "would they thank me?" bar — that's the standard to write to.

### 4.1 Infrastructure setup

| Component | Spec |
|---|---|
| Domains | **3–5 secondary domains** to start (never the main gigaprowl domain). Brand-adjacent, not lookalike-deceptive: getgigaprowl.com, trygigaprowl.com, gigaprowlhq.com, joingigaprowl.com, huntwithgigaprowl.com |
| TLDs | **.com only** if available; .co/.io acceptable fallback (2–4pt deliverability gap). Avoid .xyz/.info/.biz/.online — niche TLDs can crater Gmail opens to 3–5% |
| Mailboxes | **2–3 per domain** (e.g. alex@, jordan@, sam@) → 6–15 mailboxes total. Never 10+ boxes on one domain |
| Providers | Split across Google Workspace and Microsoft 365 (provider diversity hedges filter updates); Smartlead SmartSenders can provision |
| DNS | SPF + DKIM + DMARC (start p=none → p=quarantine), custom tracking domain per sending domain; set up before warmup day 1 |
| Warmup | **Smartlead warmup 3–4 weeks minimum before any campaign** (30 days ideal; domains ideally aged 3+ months). Ramp 5→10→20→30 warm emails/day. **Leave warmup on forever** — teams that switch it off see deliverability decay in 6–8 weeks |
| Sending cap | **20–30 cold emails/mailbox/day** (data: 20–49/day yields the best ~5.7% reply band; >50/day trips filters). Smartlead caps + auto-rotation enforce this |
| Redirect | All domains 301 → gigaprowl main site; each has a real-looking one-pager |
| Hygiene | Verify every address (NeverBounce/ZeroBounce, <2% bounce), plain-text emails, no images/attachments, throttle 3–8 min between sends, monitor via Google Postmaster Tools |

**Capacity math:** 10 mailboxes × 25/day × 22 days ≈ **5,500 cold emails/mo** at launch → scale to 20 boxes ≈ 11,000/mo once reply rates prove out. Cost: ~10 × $6 Workspace + $39–94 Smartlead + $50 domains ≈ **$120–180/mo**.

### 4.2 Lead sourcing (job seekers, ethically)

Priority order — most consented first:

1. **Your own funnel (not cold, but same Smartlead machine):** signups who never uploaded a resume, free users at hunt 3/5. Highest-ROI "outbound" you'll ever send.
2. **Public open-to-work signals — LinkedIn via PhantomBuster:**
   - Search Export Phantom on `#OpenToWork` posts + people-search with the open-to-work photo-frame filter, segment by title ("software engineer", "product manager", "data analyst") + US metro
   - Post-engagement scraping: people commenting on layoff/job-search viral posts ("commenting for reach", "open to opportunities")
   - Rate-limit Phantoms (≤80–100 profiles/day/account), secondary LinkedIn account, expect eventual account friction — this is a ToS-gray growth tactic; budget for it operationally
3. **Layoff lists:** layoffs.fyi + public "airtable of laid-off employees" lists that companies/employees publish *explicitly to get people hired* — the closest thing to consent in this channel. Google `site:airtable.com [company] layoff list`.
4. **Apollo.io:** 65+ filters. Proxy filters for job seekers: title contains "seeking/open to/former/ex-", employment gap (left company, no current role), recently-changed-jobs inverse signals, plus contacts at companies with announced layoffs (cross-reference layoffs.fyi). Note Apollo mostly returns *work* emails — for B2C you want personal emails, so enrich via waterfall (Apollo → Datagma/FullEnrich personal-email step) or use the LinkedIn-scrape path.
5. **Communities (manual, high-converting):** r/jobsearchhacks, r/layoffs, Discord job-hunt servers, Slack communities — engage, don't scrape-and-blast.

For every source: store provenance (where/when collected), US-only filter, suppression list synced with unsubscribes across ALL tools, delete on request.

### 4.3 Sequence templates (3-step, personalized at scale)

Personalization engine: scraped **LinkedIn headline + title + #OpenToWork signal** → Smartlead custom fields `{{first_name}}, {{headline_role}}, {{city}}, {{signal}}`. Use an LLM pass to normalize headlines into natural phrases ("Senior Frontend Engineer | React | ex-Stripe" → "senior frontend work"). Campaigns with real-context personalization see ~2x the reply rate of generic sends (up to ~18% vs ~9% in top studies); 50–125 words per email wins.

**Email 1 — Day 0 (value, no hard pitch):**
> Subject: `{{first_name}}, saw you're looking — quick thought`
>
> Hi {{first_name}} — saw your open-to-work post for {{headline_role}} roles.
>
> Honest question: how many applications have you sent into the void this month?
>
> I'm building Gigaprowl — you upload your resume once, it finds matching roles, then finds the actual hiring manager and builds you a personal pitch page (with an AI video of you) to send them. Applying sideways instead of through the front door.
>
> First 5 hunts are free — worth a look while you're searching? {{link}}
>
> Alex from Gigaprowl
> [physical address] · [unsubscribe]

**Email 2 — Day 3–4 (proof/demo angle):**
> Subject: re: {{first_name}}, saw you're looking
>
> One thing I should've led with: the pitch-page part is what gets replies.
>
> Instead of resume #241 in an ATS, the hiring manager gets a one-page personal pitch + a 30-second video. For {{headline_role}} roles that's usually 10–20 matches with named managers in the first hunt.
>
> 60-second demo: {{demo_link}}. Free to try.

**Email 3 — Day 8 (breakup, soft):**
> Subject: last one from me
>
> {{first_name}} — won't keep nudging; job-search inboxes are stressful enough.
>
> If the search is going great, ignore me entirely (and congrats). If it's the 200-applications-2-replies grind, Gigaprowl's free tier is here: {{link}}.
>
> Either way — good luck out there. Rooting for you.

Rules: plain text, one link max in email 1, no attachments, no "{{first_name}}!!" energy, reply-handling in Smartlead master inbox within hours (fast replies convert), auto-remove on reply.

### 4.4 Expected performance

| Metric | Benchmark | Gigaprowl expectation |
|---|---|---|
| Deliverability | >95% inbox after proper warmup | watch Gmail spam rate <0.1% |
| Open rate | 40–60% with personalized subject | 45%+ |
| Reply rate | 1–5% typical; median 3.4%; personalized top-quartile 7–18% | **4–8%** (unusually relevant offer: recipient actively wants what you sell) |
| Positive reply → signup | 30–50% of positive replies | — |
| Email → free signup | 0.5–2% of delivered | ~1% |
| Email → paid | ~0.1–0.3% (deal-close from cold email averages ~0.2%) | 5,500 emails/mo → 40–80 signups → 3–8 paid |

Verdict: cold email is Gigaprowl's **fourth** channel — cheap ($150/mo), on-brand (it's literally the product's own motion — "we found you the way Gigaprowl finds hiring managers" is a great line), but capped. It will not carry you to 100k users; ads + organic will.

---

## 5. CHANNEL PRIORITIZATION & BUDGETS

### 5.1 $0/month (sweat only)

| Effort | Channel | Motion |
|---|---|---|
| 40% | Organic TikTok/Reels/Shorts | 1 post/day from brand account: screen demos, hunt-of-the-day, job-market commentary. CareerTok reach is earnable; builds retargeting audiences for later |
| 25% | Reddit + communities | Genuinely helpful posts in r/jobs, r/resumes, r/cscareerquestions, r/layoffs (follow sub self-promo rules); Discord/Slack job-hunt groups |
| 15% | LinkedIn founder content | Build-in-public + job-search tactics posts; DM #OpenToWork posters manually (no tooling, no ToS risk at human scale) |
| 10% | Launches | Product Hunt (Jobright got 50k users in 2 months off PH + community), Hacker News Show HN, BetaList |
| 10% | Built-in virality | Every AI pitch page/video footer: "Made with Gigaprowl — hunt your next job free." The product generates shareable artifacts; every hunt is a growth loop. Add referral: give 3 hunts / get 3 hunts |

### 5.2 $1,000/month

| $ | Channel | Why |
|---|---|---|
| $500 | Meta ads ($16–17/day) | Run §1.5 week 1–4 plan continuously; cheapest structured learning; expect 50–100 signups/mo at $5–12 CPSignup |
| $250 | TikTok creator seeding + small Spark boosts | 1–2 micro creators/mo + $100 boosting the best post |
| $150 | AI UGC tools (Creatify + Captions; HeyGen already sunk) | Feeds both ad channels with 30–50 variants/wk |
| $100 | Cold email infra (Smartlead + 3 domains + 6 boxes) | Warmup this month; sending from month 2 |
| — | All $0 motions continue | Organic is still the base layer |

Expected: 150–300 signups/mo, 10–25 paid. Goal of the month: find one ad concept ≤ $10/signup.

### 5.3 $5,000/month

| $ | Channel | Why |
|---|---|---|
| $2,250 (45%) | Meta ($75/day) | Consolidate winners into CBO/ASC; retargeting on; optimize to ResumeUploaded |
| $1,500 (30%) | TikTok ($50/day) | 4–6 creators seeded/mo + Spark on hits + Smart+ always-on |
| $600 (12%) | Creative engine | Arcads tier added, Creatify, Captions, editor stipend — 50–100 variants/wk |
| $350 (7%) | Cold email scaled | 5 domains/12 boxes ≈ 7k emails/mo + PhantomBuster + verification |
| $300 (6%) | Experiments | Reddit ads (r/jobs, r/cscareerquestions — cheap, untested), newsletter sponsorships (job-search/career newsletters), micro-influencer one-offs |

Expected: 800–1,500 signups/mo, 60–120 paid/mo → ~10k users in 6–9 months blending organic. The 10k→100k leg is earned by (a) one repeatable ad concept at target CPA scaled 5–10x, (b) the pitch-page viral loop, (c) creator flywheel where Gigaprowl success stories become the ads.

### 5.4 North-star funnel metrics

**Visit → Signup → Resume upload → First hunt → Paid**

| Step | Metric | Target | Alarm |
|---|---|---|---|
| Visit→Signup | LP conversion | 8–15% (freemium benchmark: sub-5-min time-to-value tools hit 13–16%) | <5%: fix LP/ad-message match |
| Signup→Resume upload | **Activation #1 — the metric of the whole business** | >60% within 24h | <40%: shrink onboarding; every 10 min of delay to value ≈ −8% conversion |
| Upload→First hunt | Activation #2 (aha moment) | >80% | product bug territory if lower |
| Hunt→Paid | Free→paid conversion | 5–9% within 30d (B2C freemium band) | <3%: paywall placement/pricing test |
| Paid | MRR, CAC payback, M1 churn | Payback <3 mo; B2C churn is brutal — watch M1 | churn >15%/mo caps everything |

**Per-channel weekly scorecard:** spend, CPSignup, cost-per-resume-upload, CAC (paid), hook rate/CTR (creative health), plus email: reply%, spam%, signups. **Single decision rule: scale whatever delivers resume uploads <$20 and paid subs <$60 blended; kill or fix everything else.**

**Instrumentation before scaling spend:** Meta Pixel + CAPI and TikTok Pixel + Events API with the full 5-event ladder; UTM discipline everywhere (including cold-email links); a weekly cohort sheet (channel × week → % reaching each funnel step). Without CAPI/Events API, both platforms' algorithms are flying blind and every benchmark above degrades.

---

## Appendix: Sources

- Meta ASC vs manual: [Linkrunner](https://linkrunner.io/blog/meta-advantage-shopping-vs-manual-campaigns-for-app-growth-when-to-use-each), [MHI Growth Engine](https://mhigrowthengine.com/blog/advantage-plus-vs-manual-campaigns-meta-2026/), [bir.ch A+ guide](https://bir.ch/blog/advantage-plus-sales-campaigns-guide)
- Meta benchmarks: [WordStream 2025](https://www.wordstream.com/blog/facebook-ads-benchmarks-2025), [LocaliQ](https://localiq.com/blog/facebook-advertising-benchmarks/), [Stackmatix cost guide](https://www.stackmatix.com/blog/facebook-ads-cost-complete-guide)
- Meta targeting changes 2025: [FanIQ](https://www.faniq.live/blog/meta-targeting-update), [Brawn Media](https://brawnmediany.com/blog/how-metas-targeting-works-in-2025-a-complete-guide/), [LeadEnforce](https://leadenforce.com/blog/interest-targeting-on-facebook-what-still-works-and-what-doesnt)
- Scaling/budget rules: [RocketShip HQ](https://www.rocketshiphq.com/meta-budget-scaling-rules-app-campaigns/), [TheOptimizer](https://theoptimizer.io/blog/how-to-scale-meta-ads-without-killing-performance), [Stackmatix scaling](https://www.stackmatix.com/blog/meta-ads-scaling-strategy)
- Lookalikes/retargeting: [Lebesgue](https://lebesgue.io/facebook-ads/broad-targeting-beats-lookalikes-the-future-of-facebook-audience-targeting), [Adelaide Socials](https://adelaidesocials.com.au/blog/meta-retargeting-building-audiences-that-convert), [Jetfuel](https://jetfuel.agency/create-facebook-lookalike-audiences-in-7-steps-2025-guide/)
- Creative formats/UGC: [Reloop UGC guide](https://reloop.so/blog/article/ugc-advertising/), [Darkroom](https://www.darkroomagency.com/observatory/tiktok-ugc-complete-definition-and-marketing-guide-for-2025), [Billo Meta best practices](https://billo.app/blog/meta-ads-best-practices/), [Hoox](https://www.hoox.video/en/blog/ugc-for-facebook-and-tiktok-ads-best-practices-and-winning-formats)
- TikTok benchmarks/Smart+/Spark: [DigitalApplied](https://www.digitalapplied.com/blog/tiktok-ads-benchmarks-2026-cpc-cpm-cvr-industry), [TikAdSuite](https://tikadsuite.com/blog/tiktok-ad-benchmarks/), [Amra & Elma Spark stats](https://www.amraandelma.com/tiktok-spark-ads-statistics/), [AdManage](https://admanage.ai/blog/how-much-does-it-cost-to-advertise-on-tiktok)
- Creator rates/whitelisting: [InfluencerMarketingHub](https://influencermarketinghub.com/whitelisting-and-spark-ads/), [LaunchPoint rates](https://www.launchpointhq.com/guides/rates/how-much-do-ecommerce-tiktok-creators-charge), [ATTN Agency](https://www.attnagency.com/blog/tiktok-spark-ads-whitelisting-guide), [InfluencerFee](https://influencerfee.com/post.php?slug=tiktok-spark-ads-cost)
- CareerTok: [InfluencerMarketingHub CareerTok](https://influencermarketinghub.com/careertok-is-the-new-career-center/), [Joveo](https://www.joveo.com/blog/tiktok-recruiting-gen-z-job-search/), [ContentGrip](https://www.contentgrip.com/tiktok-career-coach-gen-z/)
- AI UGC tools: [eesel Arcads pricing](https://www.eesel.ai/blog/arcads-ai-pricing), [AdMake HeyGen vs Arcads](https://admakeai.com/blog/heygen-vs-arcads), [Atlabs comparison](https://www.atlabs.ai/blog/atlabs-ai-vs.-heygen-vs.-creatify-vs.-arcads-vs.-viralinn-which-ai-ugc-tool-is-actually-worth-paying-for-in-2026), [DesignRevision](https://designrevision.com/blog/best-ai-ugc-tools), [Icon pricing](https://icon.com/pricing), [Captions pricing](https://captions.ai/pricing)
- Naming conventions: [AdAmigo](https://www.adamigo.ai/blog/meta-ad-naming-conventions-guide), [MagicBrief](https://magicbrief.com/post/naming-conventions-for-ad-creative-analysis), [Apogee](https://www.apogee.ad/en/blog/nomenclature-meta-ads-guide/)
- Smartlead/cold email infra: [Smartlead frequency data](https://www.smartlead.ai/blog/email-frequency-best-practices-for-cold-emails), [Smartlead warmup guide](https://www.smartlead.ai/blog/email-warm-up-guide), [Quota Engine review](https://www.quotaengine.com/tools/smartlead/), [LeadHaste](https://leadhaste.com/blog/how-to-use-smartlead-for-cold-email)
- TLDs/domains: [InboxKit TLDs](https://www.inboxkit.com/learn/best-domain-extensions-cold-email), [Mailforge](https://www.mailforge.ai/blog/do-tlds-impact-cold-email-deliverability), [MailReach](https://www.mailreach.co/blog/email-domains-explained-how-to-pick-use-and-optimize-for-maximum-deliverability)
- Reply benchmarks: [Belkins study](https://belkins.io/blog/cold-email-response-rates), [The Digital Bloom](https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/), [SalesCaptain](https://www.salescaptain.io/blog/cold-email-statistics), [Woodpecker](https://woodpecker.co/blog/cold-email-statistics/)
- Legal: [Overloop country guide](https://overloop.com/blog/cold-email-illegal), [InboxKit compliance](https://www.inboxkit.com/learn/cold-email-compliance-gdpr-can-spam), [Reachoutly](https://reachoutly.com/cold-email/legality/), [PhantomBuster legality](https://phantombuster.com/blog/linkedin-automation/is-linkedin-scraping-legal/), [Lobstr](https://www.lobstr.io/blog/is-linkedin-scraping-legal)
- Lead sourcing: [Apollo recruiting filters](https://www.apollo.io/magazine/10x-qualified-candidates-with-these-recruiting-filters), [Layoffs.fyi](https://layoffs.fyi/), [Recruiterflow layoff lists](https://recruiterflow.com/blog/layoffs-lists/)
- Funnel benchmarks: [1Capture trial benchmarks](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025), [ChartMogul SaaS Conversion Report](https://chartmogul.com/reports/saas-conversion-report/), [Userpilot](https://userpilot.com/blog/saas-average-conversion-rate/)
- Competitor GTM: [Starter Story on Jobright](https://www.starterstory.com/jobright-ai-breakdown)
