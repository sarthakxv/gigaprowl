# Gigaprowl — Authentication, Email, and Launch Guide

This guide documents the application as it works today and the intended production setup. It deliberately separates account email from cold outreach because sharing a sending domain puts password-reset delivery at risk.

## 1. Current authentication behavior

Gigaprowl currently uses its own email/password authentication:

- Passwords are hashed with scrypt in `lib/auth.js`.
- Sessions use the signed `prowl_session` cookie.
- Signup and login are active.
- Password-reset links are single-use and expire after one hour.
- Signup currently creates users as `emailVerified: true`. Email verification is therefore **not active**.

The verification route, resend route, page, token support, and email template still exist, but they are not part of the live signup flow. Do not tell users that signup verification is enabled, and do not use the verification flag as a security gate in the current system.

### Planned authentication migration

The target architecture in `docs/architecture-v2.md` moves identity to Supabase Auth. Supabase should become the single owner of sessions, email confirmation, password reset, and magic links. When that migration is implemented, retire the custom session and verification/reset-token paths instead of running two authentication systems in parallel.

## 2. Password reset

The current password-reset flow is active:

1. `/api/auth/forgot` accepts an email address and always returns the same response, whether or not the account exists.
2. If the account exists and Resend is configured, the server creates a one-hour reset token and sends a link.
3. `/reset` validates the token before showing the form.
4. `/api/auth/reset` consumes the token, changes the password, and signs the user in.

If `RESEND_API_KEY` is missing, the forgot-password endpoint still returns success but no message is sent. Test this flow after every production email or domain change.

## 3. Keep account email and outreach separate

Use distinct reputation paths:

- **Account and transactional email:** a dedicated subdomain such as `mail.gigaprowl.app`, sent through Resend. Use it for password resets and, after the Supabase migration, confirmation and magic-link messages.
- **Cold outreach:** the user's connected Gmail account, via Google OAuth send-as / drafts. Never send cold campaigns from the app domain or the account-email subdomain.

Outreach dispatch does not use Resend. `RESEND_SYSTEM_FROM` keeps account mail on the transactional domain; configure it explicitly.

## 4. Configure the account-email domain

### 4.1 Add the domain to Resend

1. In Resend, add the account-email subdomain, for example `mail.gigaprowl.app`.
2. Add the exact DKIM, SPF, and return-path records Resend provides to the domain's DNS.
3. Add a DMARC record in monitoring mode first. Review reports before tightening the policy to quarantine or reject.
4. Wait until Resend reports the domain as verified.

Do not copy example DKIM or SPF values from documentation; provider-generated values are specific to the account and domain.

### 4.2 Configure production variables

Set these for the production deployment and redeploy:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public application URL used to build reset links |
| `RESEND_API_KEY` | Sends transactional email through Resend |
| `RESEND_SYSTEM_FROM` | Account-email sender, for example `Gigaprowl <accounts@mail.gigaprowl.app>` |
| `RESEND_FROM` | Non-system sender used by the current sending code; do not point cold outreach at the account-email domain |
| `RESEND_WEBHOOK_SECRET` | Validates signed Resend webhook events |

The Resend test sender can normally deliver only to the email associated with the Resend account. A verified domain is required before testing password reset with other recipients.

### 4.3 Configure the Resend webhook

Create a Resend webhook pointing to:

```text
https://<app-domain>/api/webhooks/resend
```

Subscribe to the delivery, bounce, and complaint events used by the application, then copy the webhook signing secret to `RESEND_WEBHOOK_SECRET`. The webhook records delivery events and suppresses addresses that hard-bounce or complain.

## 5. Readiness for roughly 1,000 users

The current application can support an early launch, but the following work should be completed before treating 1,000 users as routine production load:

- Move authentication and primary data from custom cookies and per-user Redis blobs to Supabase as planned.
- Move long-running scans, enrichment, video generation, and cadence work out of request handlers and into the planned Inngest workflows.
- Keep Upstash for rate limiting and cache after the migration; monitor command volume while it remains the primary store.
- Fan out scheduled work per user instead of processing the full user registry serially in one serverless invocation.
- Keep login, signup, and forgot-password rate limits enabled and monitor repeated failures.
- Warm outreach inboxes gradually in Smartlead, verify recipient addresses, and pause senders when bounce or complaint rates rise.
- Maintain a global suppression list and an emergency stop for each sending domain.
- Keep account email isolated from all cold-outreach reputation.

## 6. Launch checklist

- [ ] Confirm signup and login work with the current custom authentication.
- [ ] Confirm the product does not claim that signup email verification is active.
- [ ] Verify the account-email subdomain in Resend.
- [ ] Set `APP_URL`, `RESEND_API_KEY`, `RESEND_SYSTEM_FROM`, and `RESEND_WEBHOOK_SECRET` in production.
- [ ] Redeploy after changing production variables.
- [ ] Test password reset end to end with a non-owner recipient on the verified domain.
- [ ] Send a signed Resend test webhook and confirm the endpoint accepts it.
- [ ] Test bounce and complaint handling and confirm suppression is recorded.
- [ ] Confirm outreach cannot send from the account-email domain (Gmail send-as only).
- [ ] Configure Google OAuth (`APP_URL`, `GOOGLE_CLIENT_*`, `GMAIL_TOKEN_ENCRYPTION_KEY`) and complete a test connect + draft.
- [ ] Confirm `/api/cron/scheduler` returns 401 without `CRON_SECRET` in production.
- [ ] Monitor Redis usage and scheduled-job duration during the first user batches.
- [ ] Plan the Supabase Auth migration before re-enabling email confirmation.

## 7. Definition of done for email confirmation

Email confirmation should be considered live only after the Supabase Auth migration is complete and all of the following are true:

- New users are created as unconfirmed by the identity provider.
- The provider sends a confirmation link through the verified account-email domain.
- Protected product actions reject unconfirmed users server-side.
- Resend and expired-link behavior are tested.
- Product copy and support documentation match the actual flow.

Until then, password reset is the only active account-email flow; signup verification remains intentionally bypassed.

## 8. Gmail outreach (Google OAuth)

Gigaprowl account login stays email/password. Gmail connect is a separate Google OAuth 2.0 authorization-code grant with offline access. It is not Google Sign-In.

### 8.1 Production variables

| Variable | Purpose |
|---|---|
| `APP_URL` | Canonical public URL. Production OAuth callback is `{APP_URL}/api/connect/google/callback`. Defaults to `PRODUCTION_APP_URL` in `lib/constants.js`. Never derived from forwarded Host headers in production. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client from a dedicated production Google Cloud project |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 32-byte AES-256-GCM key (64 hex characters). Refresh tokens are stored only in encrypted form |
| `SESSION_SECRET` | Signs session cookies. Do not reuse the OAuth state for sessions |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Stores the single-use OAuth nonce (10-minute TTL) and user state |
| `CRON_SECRET` | Required for `/api/cron/scheduler` in production |

Existing plaintext Gmail grants are rejected. Those users see "Reconnect Gmail" and must complete OAuth again.

### 8.2 Google Cloud project

1. Enable the Gmail API in a dedicated production project. Keep development users on a separate testing project.
2. Configure the External consent screen with a verified domain, homepage, privacy policy, terms, and support contact.
3. Register the exact callback `{PRODUCTION_APP_URL}/api/connect/google/callback` from `lib/constants.js`.
4. Declare scopes `gmail.compose`, `openid`, and `email` (`gmail.compose` is restricted).
5. Complete restricted-scope verification (and any required security assessment) before public rollout.
6. Position the feature as low-volume, user-directed job outreach. Keep manual-by-default behavior and daily caps.

### 8.3 Runtime behavior

- Manual mode creates Gmail drafts only. Automated mode sends only after the user selects Automated.
- Health: `GET /api/connect/google/health`. Disconnect: `POST /api/connect/google/disconnect` (revokes at Google when possible, always deletes the local grant).
- `invalid_grant`, revocation, and missing compose scope mark the connection `reauth_required` and stop scheduled email for that user.
- OAuth state is single-use, expires after ten minutes, and is bound to the exact signed-in session that started the connection.
- If a Gmail mutation has an unknown outcome, the cadence stops on **Check Gmail** instead of retrying and risking a duplicate.
