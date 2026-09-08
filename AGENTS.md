# Gigaprowl repository guide

## Orient first

Gigaprowl is a Next.js 14 App Router application for job matching, personalized
outreach, and a companion LinkedIn extension. Treat the code and configuration
as the source of truth: `package.json` for commands and dependencies,
`.env.example` for supported configuration, and `vercel.json` for scheduled
routes. `docs/architecture-v2.md` is a future-state draft; do not implement it
as though it already describes the running application. Consult
`docs/OBSOLETE.md` before reviving a removed integration or flow.

## Where changes belong

- UI and page routes live in `app/`; API handlers use
  `app/api/<feature>/route.js`.
- Reusable domain and integration code belongs in `lib/`. Keep route handlers
  focused on request validation, authorization, and response formatting.
- The Manifest V3 browser companion is self-contained in `extension/`; read
  `extension/README.md` before changing its pairing, polling, or LinkedIn
  execution flow.
- Product, launch, architecture, and GTM material lives in `docs/`. Treat
  generated media and local application state as disposable local artifacts.

## Application invariants

- This is a multi-tenant app. For authenticated API routes, derive the user
  from `getUserId(req)` in `lib/auth.js`; never accept a client-supplied user
  ID as authorization. Read and mutate per-user state through `lib/db.js`,
  using `updateUserState` for writes.
- Most APIs use Node-only dependencies (`fs`, crypto, PDF/DOCX parsing, or
  native rasterization). Set `export const runtime = "nodejs"` for such routes;
  retain an Edge runtime only when its dependency boundary supports it.
- Scheduled and administrative endpoints must keep their existing secret or
  provider-signature checks. Preserve limits, idempotency checks, suppression
  handling, and the manual-by-default outreach mode when extending automation.
- Local persistence falls back to ignored JSON files under `data/`; production
  uses the configured Upstash/Vercel KV REST service. Do not add sensitive or
  user-uploaded data to the repository.

## Code and verification

Use JavaScript/JSX, ES modules, two-space indentation, semicolons, and double
quotes. Use PascalCase for React components, camelCase for functions and
variables, and the `@/` import alias for repository-root modules. Prefer
Tailwind utilities and shared tokens; keep `app/globals.css` genuinely global.
Use `lucide-react` for UI icons; do not add inline SVG icons or another icon
library.

There is no test or lint script. For code changes, run `npm run build` and
manually exercise the changed UI or API path, including its authorization,
invalid-input, and keyless/fallback behavior when applicable. Update
`.env.example` whenever a new environment variable is required, without
including credentials in documentation, logs, or commits.

## Change hygiene

Keep commits focused and imperative. Preserve unrelated working-tree changes.
For UI work, include a screenshot in the pull request; for integration or
deployment work, call out new configuration, provider setup, webhook, or cron
requirements.

## Agent skills

### Issue tracker

GitHub Issues in `sarthakxv/gigaprowl` are the issue tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context layout with a root `CONTEXT.md` and ADRs in `docs/adr/`. See `docs/agents/domain.md`.
