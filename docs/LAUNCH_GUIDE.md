# Gigaprowl — Email Authentication & Launch Guide (1,000 users)

This covers both meanings of "email authentication" you need before launch:

1. **User email authentication** — verifying your users' email addresses at signup + password reset (built, live once env is set).
2. **Sending-domain authentication** — SPF / DKIM / DMARC so Gigaprowl's emails land in the inbox instead of spam (needs a domain).

Plus a scaling plan for 1,000 users.

---

## 0. What was built (backend)

New/updated backend, all deployed and domain-ready:

| Area | Files |
|---|---|
| Single-use expiring tokens (KV + TTL) | `lib/tokens.js`, `lib/db.js` |
| Branded email templates | `lib/email-templates.js` |
| Signup → sends verification email | `app/api/auth/signup/route.js` |
| Verify email (consume token) | `app/api/auth/verify/route.js`, `app/verify/page.jsx` |
| Resend verification (5/day cap) | `app/api/auth/verify/resend/route.js` |
| Forgot password (enumeration-safe) | `app/api/auth/forgot/route.js` |
| Reset password (single-use token) | `app/api/auth/reset/route.js`, `app/reset/page.jsx` |
| "Forgot password?" on login | `app/login/page.jsx` |
| Deliverability webhook (Svix-signed) | `app/api/webhooks/resend/route.js` |
| Suppression list + daily send caps | `lib/db.js`, `lib/dispatch.js`, `lib/resend.js` |

**Security properties:** tokens are 32-byte random, stored server-side with a TTL, single-use (deleted on consumption). Verify links expire in 3 days, reset links in 1 hour. Forgot-password always returns the same response whether or not the account exists (no email enumeration). Hard bounces + spam complaints are auto-suppressed so you never re-email a dead/angry address.

---

## 1. User email authentication (verify + reset)

Already wired. It sends today **only to your own Resend account email** (`vardanagarwal16@gmail.com`) because you're still on the `onboarding@resend.dev` test sender. To send verification/reset emails to *real users*, you must verify a domain (Section 2).

Flow:

- **Signup** creates the user with `emailVerified: false` and emails a confirm link.
- **Clicking the link** flips `emailVerified: true` and lands on `/verify?status=ok`.
- **Forgot password** on the login screen → emails a 1-hour reset link → `/reset` sets a new password and signs the user in.

> **Recommended gate:** keep signup working without verification (low friction), but require a verified email before allowing outbound outreach. The `emailVerified` flag is exposed on `/api/auth/me` so the dashboard can show a "Confirm your email to start outreach" banner. Say the word and I'll add the hard gate + banner.

---

## 2. Sending-domain authentication (SPF / DKIM / DMARC)

This is what makes your outbound land in the inbox. It requires a domain you own.

### Step 2.1 — Buy a domain

Recommended: a short `.com`. Register at **Cloudflare Registrar** (at-cost pricing, free DNS, fast propagation) or Namecheap. Ideas: `getgigaprowl.com`, `gigaprowl.jobs`, `trygigaprowl.com`, `gigaprowlhq.com`.

Keep your **app** and your **sending** on the same root domain but use a **subdomain for sending** so a deliverability problem never taints your main domain:

- App: `gigaprowl.com` (or `app.gigaprowl.com`)
- Sending: `send.gigaprowl.com` (what you'll verify in Resend)

### Step 2.2 — Verify the domain in Resend

1. Resend dashboard → **Domains → Add Domain** → enter `send.gigaprowl.com`.
2. Resend shows you **DNS records to add**. They look like this (your exact values will differ — copy from Resend, not from here):

```
# DKIM (Resend generates the selector + key)
Type: TXT    Name: resend._domainkey.send    Value: p=MIGfMA0GCSq...   (long key)

# SPF — authorizes Resend's mail servers
Type: MX     Name: send                       Value: feedback-smtp.us-east-1.amazonses.com   Priority: 10
Type: TXT    Name: send                       Value: v=spf1 include:amazonses.com ~all
```

3. Add a **DMARC** record on the root (tells receivers what to do with unauthenticated mail):

```
Type: TXT    Name: _dmarc                      Value: v=DMARC1; p=none; rua=mailto:dmarc@gigaprowl.com; fo=1
```

Start with `p=none` (monitor only). After 1–2 weeks of clean reports, tighten to `p=quarantine`, then `p=reject`.

4. Back in Resend, click **Verify**. Propagation is usually minutes (Cloudflare) to a few hours.

### Step 2.3 — Point the env at your domain

Once verified, set these in Vercel (Section 3) and redeploy:

```
RESEND_FROM=Gigaprowl <hello@send.gigaprowl.com>          # outreach + default
RESEND_SYSTEM_FROM=Gigaprowl <accounts@send.gigaprowl.com> # verify/reset emails
APP_URL=https://gigaprowl.com                           # used to build verify/reset links
```

---

## 3. Environment variables (Vercel → Settings → Environment Variables)

Already set: `UNIPILE_DSN`, `UNIPILE_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`.

Add these:

| Var | Value | Why |
|---|---|---|
| `APP_URL` | `https://prowl-livid.vercel.app` (then your domain) | Builds correct verify/reset links |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` from Resend → Webhooks | Verifies webhook signatures |
| `RESEND_SYSTEM_FROM` | `Gigaprowl <accounts@send.gigaprowl.com>` | Sender for account emails (after domain) |
| `CAP_EMAIL_PER_DAY` | `50` (default) | Per-user daily email cap |
| `CAP_LINKEDIN_PER_DAY` | `20` (default) | Per-user daily LinkedIn cap |

**Any env change requires a redeploy to take effect.**

### Resend webhook

Resend dashboard → **Webhooks → Add Endpoint**:

- URL: `https://gigaprowl.com/api/webhooks/resend` (or the vercel.app URL for now)
- Events: `email.bounced`, `email.complained`, `email.delivered`, `email.opened`
- Copy the signing secret (`whsec_…`) into `RESEND_WEBHOOK_SECRET`.

---

## 4. Scaling plan for 1,000 users

### 4.1 Data layer (Upstash Redis)
- Current model is one KV blob per user (`prowl:u:<id>`) + a global `prowl:users` list the cron iterates. This is fine at 1,000 users.
- **Watch:** Upstash free tier ≈ 10k commands/day. 1,000 active users will blow past that — move to a **paid Upstash plan** (pay-as-you-go, ~$0.20/100k commands) before launch.
- The daily cron iterates every user serially. At 1,000 users, batch it (e.g. process 100/invocation) or shard by user-id hash across a couple of cron runs so a single invocation stays under Vercel's function timeout.

### 4.2 Email deliverability (the #1 launch risk)
- **Warm up the domain.** A brand-new domain sending 1,000× outreach on day one = spam folder + blacklist. Ramp: ~50 emails/day week 1, doubling weekly, watching bounce/complaint rates.
- Keep **hard-bounce rate < 2%** and **complaint rate < 0.1%** — the webhook + suppression list enforce this automatically by removing bad addresses.
- Verify email addresses before sending (you already have LeadMagic enrichment). Never send to unverified guesses.
- The per-user cap (`CAP_EMAIL_PER_DAY=50`) means 1,000 users × 50 = a theoretical 50k/day. Resend paid plans handle this, but **you** should also cap total platform volume during warmup with a global counter (I can add one).

### 4.3 LinkedIn (Unipile) limits
- LinkedIn restricts invites to **~100–200/week per account**. `CAP_LINKEDIN_PER_DAY=20` keeps each user's own account safe.
- Each user connects **their own** LinkedIn via Unipile, so limits are per-user, not shared — this scales cleanly. Unipile bills per connected account, so 1,000 users = check Unipile's per-account pricing tier.

### 4.4 App layer (Vercel)
- Next.js API routes are serverless and auto-scale; no change needed for 1,000 users.
- Move any heavy work (video generation, bulk enrichment) to background jobs / queues so request handlers stay fast.
- Add **rate limiting on auth endpoints** (login, signup, forgot) to stop credential-stuffing — I can add an IP-based limiter using the same counter helper.

### 4.5 Costs to budget (rough, 1,000 users)
- Upstash Redis: ~$5–20/mo depending on activity.
- Resend: free to 3k emails/mo, then ~$20/mo for 50k. High-volume outreach → higher tier.
- Unipile: per connected LinkedIn account — get their volume pricing.
- Vercel: Pro ($20/mo) recommended for a real launch (longer function timeouts, more bandwidth).

---

## 5. Launch checklist

- [ ] Buy domain, point DNS at Cloudflare
- [ ] Verify `send.<domain>` in Resend (SPF + DKIM + DMARC green)
- [ ] Set `APP_URL`, `RESEND_FROM`, `RESEND_SYSTEM_FROM`, `RESEND_WEBHOOK_SECRET` in Vercel → redeploy
- [ ] Add Resend webhook endpoint, confirm test event shows 200
- [ ] Upgrade Upstash to a paid plan
- [ ] Send yourself a signup → confirm the verification email arrives from your domain
- [ ] Test forgot-password end to end
- [ ] Send a test bounce (Resend has a `bounced@resend.dev` test address) → confirm it lands in the suppression list
- [ ] Start domain warmup (low volume, ramp weekly)
- [ ] (Optional) add: hard email-verification gate + banner, global volume cap, auth-endpoint rate limiting

---

*Tell me which of the optional items you want and I'll build them next. The domain is the single unlock — the moment `send.<yourdomain>` is verified in Resend and the env vars are set, real users get real emails.*
