# Gigaprowl LinkedIn Engine (Chrome extension)

Runs your Gigaprowl LinkedIn outreach — connection requests + DMs — from **your own
browser session**. Your LinkedIn cookie never leaves your machine; requests go
out from your real IP/fingerprint, paced to stay under the radar.

## Install (unpacked, for now)
1. Chrome → `chrome://extensions` → toggle **Developer mode** (top-right).
2. **Load unpacked** → select this `extension/` folder.
3. Click the Gigaprowl icon in the toolbar.
4. In Gigaprowl → dashboard → **Connect LinkedIn**, copy the pairing token.
5. Paste it into the extension popup, set the Gigaprowl URL, hit **Save & pair**.
6. Keep a LinkedIn tab open and stay logged in.

## How it works
- `background.js` polls `GET /api/li/pull` every ~2 min for queued actions.
- For each action it messages a `linkedin.com` tab; `content.js` runs the
  LinkedIn Voyager call (invite or DM) using the page's own session + CSRF token.
- Results are reported to `POST /api/li/ack`; the dashboard marks the step sent.
- Actions are spaced 15–35s apart and capped ~20 invites/day server-side.

## Maintenance note
LinkedIn's Voyager API is undocumented and changes periodically. If invites/DMs
start failing, update `resolveProfileId` / `sendInvite` / `sendMessage` in
`content.js` — that's the only surface that depends on LinkedIn internals.

## Safety
Automating LinkedIn violates its Terms of Service and can get accounts
restricted. Keep daily volumes low, personalize messages, and pause if LinkedIn
shows any security prompts.
