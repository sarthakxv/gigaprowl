# Deferred obsolete-code register

Last reviewed: 2026-08-23

This file records code that appears obsolete but was deliberately left unchanged during the cleanup pass. It is a review queue, not proof that every item can be deleted blindly. Before removing an item, search for new callers and confirm that the related product behavior has not been restored.

## 1. Unused helper exports

These exports have no callers in the current repository.

### `peekDailyCounter` — `lib/db.js`

- **Original intention:** read a user's current UTC-day send count without incrementing it, presumably for a usage meter or remaining-quota display.
- **Why it looks obsolete:** dispatch enforcement uses `bumpDailyCounter`; no current page or endpoint reads the counter separately.
- **Before removal:** confirm no quota/status UI is planned to use the existing Redis counter.

### `signalsEnabled` — `lib/signals.js`

- **Original intention:** expose whether `PARALLEL_API_KEY` is configured so a caller could display integration status or choose a feature path.
- **Why it looks obsolete:** `getHiringSignal` already checks the key internally and falls back to a deterministic mock. No caller needs the separate capability flag.
- **Before removal:** confirm no settings or diagnostics page is going to expose Parallel availability.

### `signalHook` — `lib/signals.js`

- **Original intention:** turn a hiring signal into a short first-person outreach opener.
- **Why it looks obsolete:** cadence generation formats the same information directly in `lib/ai.js`; this shared formatter is never called.
- **Before removal:** decide whether cadence generation should call this helper instead. If not, delete it rather than maintaining two implementations.

### `getMe` — `lib/unipile.js`

- **Original intention:** fetch one connected Unipile account as a connection sanity check.
- **Why it looks obsolete:** account connection and reconciliation use `listAccounts` and `listLinkedInAccounts`; nothing calls the single-account helper.
- **Before removal:** confirm there is no planned per-account health-check endpoint.

## 2. Abandoned Scout Parallel.ai profile flow

Scout originally started a long-running Parallel.ai profile-research task, returned its run ID to the browser, and let the page poll until the result was ready. The active implementation now resolves the profile synchronously through Unipile and falls back to Claude/demo inference.

### Server-side pieces — `lib/scout.js`

- `startParallelRun(linkedinUrl)` creates the asynchronous Parallel task.
- `readParallelRun(runId, linkedinUrl)` polls task status and reads the result.
- `PARALLEL_KEY`, `PARALLEL_BASE`, and `PARALLEL_PROFILE_PROCESSOR` at the top of this module exist only for that abandoned path.
- `PROFILE_SCHEMA` exists only to describe the abandoned Parallel task output.

None of these pieces is imported by `/api/scout` or another caller.

### Browser-side remnants — `app/scout/page.jsx`

- `runId` state and the polling loop in `runScan` expect an API response with `status: "running"` and `runId`.
- The active API always returns `status: "done"` and never returns a run ID, so the polling branch cannot run.
- `phase: "teaser"`, `teaser` state, and the locked-report JSX are unreachable because nothing sets the phase to `teaser` or populates `teaser`.
- The optional email-capture form is active and should be preserved, but its `runId` request field is ignored by the API.

### API remnants — `app/api/scout/route.js`

- `locked: false` is a leftover response field from the abandoned report gate and has no current consumer.
- The route comment correctly describes the current behavior: the full report is always returned and email capture is optional.

### Other unused Scout exports — `lib/scout.js`

- `scout(linkedinUrl, opts)` is an older wrapper around fallback inference plus report building. The API now calls `inferProfile` and `buildReport` directly.
- `getScoutLeads()` reads the lead index but has no admin page, route, or other caller.
- The `inferProfile` comment still refers to `teaser+unlock`, although the teaser gate no longer exists.

### Suggested cleanup boundary

If the synchronous Unipile flow is the final product decision, remove the asynchronous Parallel constants, schema, functions, browser polling, unreachable teaser UI, redundant response fields, unused wrapper, unused lead reader, and stale comments together. Keep `saveScoutLead` and the optional email form unless lead capture is also being retired.

## 3. Dormant custom email-verification stack

Signup currently creates every account with `emailVerified: true`, and `/api/state` also reports the account as verified. Consequently, the custom confirmation flow cannot be reached through normal signup behavior.

The dormant stack consists of:

- `app/api/auth/verify/route.js`
- `app/api/auth/verify/resend/route.js`
- `app/verify/page.jsx`
- `markEmailVerified` in `lib/auth.js`
- `verifyEmail` in `lib/email-templates.js`
- the `verify` token TTL and verification-specific use of `createToken`/`consumeToken` in `lib/tokens.js`
- verification-related comments in `lib/resend.js` and `lib/tokens.js`

### Why it was kept

Password reset still uses the shared token and email infrastructure, so `lib/tokens.js`, the reset template, and system-email sending cannot be removed wholesale. Also, authentication is planned to move to Supabase Auth, which should own confirmation, resets, magic links, and sessions. Deleting only the dormant verification branch is reasonable, but it should be coordinated with that migration rather than partially reactivating the custom system.

### Suggested cleanup boundary

When Supabase Auth is introduced, remove the custom verification routes/page/template/function and migrate password reset before retiring the remaining custom token/session code. Until then, product copy must continue to say that signup verification is bypassed.

## Completed during the cleanup pass

These are recorded here so they are not investigated again as deferred work:

- Deleted the temporary `deploy.command` file. Its embedded Vercel token must still be revoked because it remains in Git history.
- Deleted the unused Higgsfield/Seedance integration in `lib/higgsfield.js`.
- Removed the unused direct `pngjs` dependency from `package.json` and `package-lock.json`.
- Rewrote `docs/LAUNCH_GUIDE.md` so it no longer claims signup verification is live.

## Re-review checklist

For the next cleanup pass:

1. Search the repository for every symbol and file above.
2. Confirm the current authentication and Scout product decisions.
3. Delete one coherent feature path at a time rather than isolated supporting lines.
4. Run `npm run build` and manually exercise signup, password reset, Scout scanning, and optional Scout lead capture.
5. Update this register by removing completed entries or documenting why an item was retained.
