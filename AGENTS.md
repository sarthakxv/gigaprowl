# Gigaprowl repository guide

## Orient first

Gigaprowl is a Next.js 14 App Router application for job matching, personalized
outreach, and a companion LinkedIn extension. Treat running code and
configuration as truth: `package.json` for commands and dependencies,
`.env.example` for supported configuration, and `vercel.json` for scheduled
routes. `docs/architecture-v2.md` is a future-state draft. Consult
`docs/OBSOLETE.md` before reviving a removed integration or flow. Issues live
in GitHub (`sarthakxv/gigaprowl`).

## Where changes belong

- Pages and UI live in `src/app/`; API handlers use
  `src/app/api/<feature>/route.js`. Keep handlers to validation,
  authorization, and response shaping; put reusable domain and integration
  code in `src/lib/`. Shared cross-route UI lives in `src/components/`;
  route-local files stay next to their pages.
- Import shared URLs, TTLs, caps, and KV key shapes from `src/lib/constants.js`.
- The Manifest V3 companion is self-contained in `extension/`; read
  `extension/README.md` before changing pairing, polling, or LinkedIn
  execution.
- `src/app/prototype/` is a sandbox UI, not the production product surface.
- Product, launch, and GTM material lives in `docs/`. Treat generated media
  and local `data/` as disposable artifacts.

## Application invariants

- Multi-tenant. Session routes derive the user with `getUserId(req)` from
  `src/lib/auth.js`. Extension pull/ack authenticates with header `x-prowl-token`
  (a signed session token from `/api/li/pair`). Cron and admin routes keep
  their existing secret checks (`src/lib/cron-auth.js` for the scheduler).
  Stripe and Resend webhooks verify provider signatures.
- Read and mutate per-user state through `src/lib/db.js`, using
  `updateUserState` for writes. Production uses Upstash/Vercel KV; local
  dev writes ignored JSON under `data/`. Keep uploads and secrets out of
  the repository.
- Node runtime is the default for APIs (`fs`, crypto, PDF/DOCX, rasterization).
  Keep Edge only where the dependency boundary already supports it
  (`src/app/api/slide` is the public OG-image exception).
- Outreach stays manual-by-default (`settings.outreachMode`). Email goes
  through Gmail only: drafts in manual mode, send in automated. LinkedIn
  prefers a connected Unipile account, otherwise the browser-extension queue.
  Preserve daily caps, outreach locks, suppression, and idempotent step status
  when extending dispatch. Full hunts cost one credit; lite apply kits do not.
  Credits are unlimited in development.

## Code and verification

Use JavaScript/JSX, ES modules, two-space indentation, semicolons, and double
quotes. Use PascalCase for React components, camelCase for functions and
variables, and the `@/` import alias for `src/` modules. Prefer
Tailwind utilities and the tokens in `tailwind.config.js`; keep
`src/app/globals.css` genuinely global. Use `lucide-react` for UI icons
rather than inline SVG or a second icon library.

There is no lint script. For `src/lib/` modules that have a sibling
`*.test.mjs`, run `npm test`. For every code change, run `npm run build` and exercise the
changed UI or API path, including authorization, invalid input, and
keyless/fallback behavior. Add new environment variables to `.env.example`
without putting credentials in documentation, logs, or commits.

When driving a browser for UI verification, use Playwright Chromium from
`.playwright/cli.config.json`, not system Google Chrome. Prefer
`scripts/playwright_cli.sh` over the stock Playwright wrapper. That script
sets `PLAYWRIGHT_BROWSERS_PATH` to the real Playwright cache (Cursor shells
otherwise point it at an empty sandbox cache). If you must call
`playwright-cli` directly:

```bash
export PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"
```


## Change hygiene

Keep commits focused and imperative. Leave unrelated working-tree changes
unstaged. UI pull requests include a screenshot; integration or deploy work
names new configuration, provider setup, webhook, or cron requirements.
