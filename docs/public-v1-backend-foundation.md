# Public v1 backend foundation

Status: implementation guide for the unreleased public v1. The older
`architecture-v2.md` is historical input, not a product or technology decision.

## Decisions and boundaries

- Keep the Next.js App Router modular monolith. Route handlers validate requests,
  obtain the authenticated principal, and shape responses. Domain modules own
  state transitions; provider modules own external calls.
- Supabase Auth owns identity, Google sign-in, email magic links, and sessions.
  Resend supplies production SMTP delivery for Auth messages; it does not issue
  or verify links. Google sign-in requests identity scopes only. Gmail outreach
  retains its independent consent and refresh token.
- Supabase Postgres is the sole source of truth for durable product data. There
  is no legacy-account backfill or KV dual-write because the app has not launched.
  Do not delete old KV data as part of the cutover.
- Upstash may hold expiring caches, rate counters, locks, and short-lived OAuth
  state. It must not be the only record of a user, credit, job, suppression,
  pitch, dispatch attempt, or extension action.
- Keep video generation parked. Do not adopt the draft's auto-apply, Smartlead,
  social expansion, pricing changes, or four-week schedule in this foundation.

## Auth and trust flow

The browser uses a Supabase publishable key only for sign-in, sign-out, and
cookie-session refresh through `@supabase/ssr`. Google OAuth and magic-link
callbacks use a fixed allowlist of redirect destinations. A server-side
`requireUser` module calls Supabase Auth to verify the current user; no route
accepts a body-supplied user ID for authorization. It returns the Auth UUID and
confirmed-email state. The first confirmed request provisions the app account
and one free five-credit grant transactionally with a unique grant reference.
An Auth failure or database outage denies protected work; neither creates
anonymous defaults nor falls back to local files in production.

The Google sign-in OAuth client is separate from the Gmail outreach OAuth
client and never asks for Gmail scopes. Gmail connection state remains encrypted
server-side; the OAuth callback must consume one-time state bound to the same
signed-in account. Extension pairing exchanges a signed-in web session for an
independent, random, hashed, expiring, revocable credential scoped to pull/ack.
The extension keeps its `x-prowl-token` wire contract, but the token is no
longer a web session. Logout-everywhere and disconnect revoke pairings.

## Persistence and tenant isolation

Use versioned SQL migrations in a private `app` schema. The browser has no
database access; disable the unused Supabase Data API. Vercel functions use
the transaction pooler, a module-level Postgres.js client with a small pool,
TLS, and named prepared statements disabled. Migrations use a direct/admin
connection unavailable to runtime code. Runtime SQL roles receive explicit,
least-privilege grants, not ownership or blanket superuser rights.

Enable RLS on tenant-owned tables even though they are private. User-scoped
queries use a restricted role and a short transaction that sets a
transaction-local user UUID obtained from `requireUser`. Policies compare
`user_id` (or an account row's `id`) with that setting, with `USING` and
`WITH CHECK` as appropriate; a missing setting yields no rows. System work
(cron and verified webhooks) uses separately granted worker access. Never
assume `auth.uid()` is populated by a direct SQL connection. Foreign keys,
unique constraints, and explicit `user_id` conditions remain necessary.

Table groups:

| Group | Durable records and invariants |
| --- | --- |
| Identity and profile | App accounts keyed by `auth.users.id`, settings, versioned profile JSON and media references. No password hashes. |
| Discovery | Jobs unique by source/external ID; user/job matches unique by pair; optional scored-feed cache is disposable. |
| Hunt assets | Hunts unique by user/job; pitch slugs unique; contacts and apply kits belong to a hunt or user. Generated content may be JSONB. |
| Outreach | Cadences, individual steps, attempts, send receipts, suppressions, and extension actions have explicit owner, status, and timestamps. Due-step queries use an index. |
| Integrations | Gmail encrypted refresh-token record; Unipile account ID globally unique; extension credential hashes and expiry; one-time connect correlations. |
| Billing and audit | Credit account plus append-only ledger with unique business reference; Stripe/Resend provider-event IDs unique; scout leads have a unique normalized email. |

Index ownership foreign keys, `(user_id, status, due_at)` access patterns,
and partial pending-work indexes where useful. Use `timestamptz`, constrained
status text, and JSONB for unqueried provider payloads rather than one growing
per-user document. Keep transactions short: reserve or finalize state inside
the database, make network calls outside it, and reconcile uncertain outcomes.
`/api/state` keeps its present response shape while reading scoped tables.
Public pitch pages select published, safe fields by slug; old test links are
not carried forward.

## Public-v1 safety invariants

- A generated cadence is a draft. Its exact recipient, copy, and channels need
  explicit approval before scheduled dispatch. Editing approved content returns
  it to draft. Manual mode creates Gmail drafts and requires an explicit action
  for LinkedIn; automated mode still requires cadence approval. The database
  atomically claims each step and records uncertain outcomes without blind retry.
- Stripe and Resend endpoints reject missing or invalid production signatures.
  Provider event IDs and credit-grant references deduplicate replay inside a
  transaction. Failed suppression persistence returns a retryable error.
- Cron requests fail closed when their secret is missing or wrong. A public
  request cannot start the global job scan. Due outreach is selected from an
  indexed status/time query, not an all-user scan.
- Unipile hosted connection gets a one-time correlation nonce. Callback and
  reconciliation verify that correlation and the provider account before an
  atomic ownership claim. Never claim the newest unowned account.
- Production never substitutes demo jobs, fabricated contacts, or invented
  hiring signals. Provider failure is visible and does not consume a hunt
  credit. Public AI/cost routes are rate-limited and input-bounded.

## Configuration and rollout

Separate development and production Supabase projects require Google provider
credentials, allowed redirect URLs, a production auth-mail domain with Resend
SMTP and DNS records, a publishable key, pooled runtime DB credentials, and a
direct migration credential. Gmail's Google OAuth credentials and encryption
key stay separate. Stripe, Resend, cron, and Unipile secrets are required only
for enabled production integrations but their routes fail closed without them.
Record variable names in `.env.example`; never put values in this document.

Create and switch to `refactor/backend` before edits. Establish migrations
and a test project, then replace Auth and persistence. Cut over without
dual-writing; leave old KV records untouched as a rollback archive. The
read-only Supabase MCP must inspect actual project configuration and advisors
when it becomes available; no live setting was verified during planning.

Acceptance tests cover both sign-in methods and expired/reused links, session
refresh/logout, cross-tenant reads and writes, concurrent credit spends,
duplicate webhooks, Unipile claim races, draft non-dispatch, uncertain sends,
database outage, KV outage, invalid input, and keyless behavior. Run
`npm test`, `npm run build`, changed API-path tests, and staging smoke tests.
Public launch remains gated on durable background execution for long-running
hunts and a supported Next.js release; those are focused follow-up phases,
not post-launch deferrals.

## Implementation checkpoint

The repository now has the Supabase SSR Auth clients, Google and magic-link
entry points, a server-side verified-user boundary, a private-schema migration,
Postgres-backed durable stores, expiring-only KV, cadence approval and atomic
step claims, scoped extension credentials, correlated Unipile claims, signed
and deduplicated provider events, and fail-closed cron routes. The state API's
browser contract is unchanged. A local PostgreSQL-compatible migration test
checks tenant RLS, cross-tenant write rejection, credit constraints, and event
uniqueness; API smoke tests cover unsigned, unauthorized, and malformed calls.

This is not a production sign-off. An empty staging Supabase project must still
run the migration, provision role passwords and pooler URLs, configure Auth
Google plus Resend SMTP, and verify cookie refresh and both sign-in methods.
Run real multi-connection credit-spend, webhook-replay, Unipile-correlation,
extension-revocation, and outage tests against that project. Verify provider
callback payloads and inspect Supabase security/performance advisors. The
per-user state compatibility facade currently reads a tenant's full history
before mutation; replace hot paths with targeted repository operations before
large-scale traffic. The Next.js 14 upgrade and durable background execution
remain separate public-launch gates. Do not point production at this cutover
until these checks pass.
