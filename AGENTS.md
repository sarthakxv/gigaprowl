# Repository Guidelines

## Project Structure & Module Organization

Gigaprowl is a Next.js 14 App Router application. Page routes and UI live in `app/`; server endpoints follow the `app/api/<feature>/route.js` convention. Shared business logic and integrations belong in `lib/` (for example, `lib/match.js` for scoring and `lib/db.js` for Redis/local JSON persistence). The browser companion is isolated in `extension/`. Product, architecture, launch, and go-to-market material live in `docs/` (including `docs/gtm/`). Local state is written to `data/` and ignored by Git.

## Build, Test, and Development Commands

- `npm ci` installs the exact dependency versions from `package-lock.json`.
- `cp .env.example .env` creates local configuration; integrations fall back to demo behavior when keys are absent.
- `npm run dev` starts the development server at `http://localhost:3000`.
- `npm run build` creates a production build and is the primary pre-PR validation check.
- `npm start` serves the completed production build locally.

There is currently no lint or automated test script. Do not document or rely on one without adding its configuration and package script.

## Coding Style & Naming Conventions

Use JavaScript/JSX with ES modules, two-space indentation, semicolons, and double quotes, matching the existing code. Name React components in PascalCase (`VoiceRecorder.jsx`), functions and variables in camelCase, and route files exactly `route.js`. Prefer the `@/` import alias for repository-root imports. Keep API handlers thin: validate requests and format responses in the route, then place reusable domain logic in `lib/`. Use Tailwind utility classes and the shared tokens defined in `tailwind.config.js`; reserve `app/globals.css` for genuinely global styles.

## Testing Guidelines

Until a test runner is introduced, run `npm run build` and manually exercise changed pages and API routes, including success, invalid-input, and integration-fallback paths. When adding automated tests, include the runner and `npm test` script in the same PR, and use clear `*.test.js` or `*.test.jsx` names near the module under test.

## Commit & Pull Request Guidelines

History is minimal, so follow its concise, imperative style: `Add Resend webhook validation`. Keep commits focused. PRs should explain the user-visible change, list verification performed, link relevant issues, and include screenshots for UI changes. Call out new environment variables, cron changes, or external-service setup explicitly.

## Security & Configuration

Never commit `.env`, tokens, user uploads, or generated `data/`. Add placeholders and comments to `.env.example` for new settings. Preserve demo-mode fallbacks where practical, and avoid logging credentials, session cookies, resumes, or provider payloads containing personal data.
