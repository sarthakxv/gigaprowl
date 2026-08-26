# Gigaprowl LinkedIn Engine (Chrome extension)

Manifest V3 companion (`v0.1.0`) that runs Gigaprowl LinkedIn outreach — connection
requests + DMs — from **your own browser session**. Your LinkedIn cookie never
leaves your machine; requests go out from your real IP/fingerprint.

When Unipile managed LinkedIn is enabled on the server, that is the primary send
path. This extension is the browser-session path (and the fallback when Unipile
is not connected).

## Install (unpacked)

1. Chrome → `chrome://extensions` → toggle **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Click the Gigaprowl toolbar icon.
4. In Gigaprowl → dashboard → **Connect LinkedIn (browser extension)** → copy the pairing token.
5. Paste the token into the popup, set the Gigaprowl URL (default
   `https://prowl-livid.vercel.app`, or your local/preview host), hit **Save & pair**.
6. Keep a LinkedIn tab open and stay logged in. Use **Run now** in the popup to
   poll immediately; otherwise it polls every ~2 minutes.

`manifest.json` allows `linkedin.com`, `prowl-livid.vercel.app`, and `*.vercel.app`.
For a custom domain or `localhost`, add that origin under `host_permissions` and reload.

## How it works

- `background.js` (service worker) uses a Chrome alarm to `GET /api/li/pull` every
  ~2 min with header `x-prowl-token`.
- Queued actions are handed to a `linkedin.com` tab; `content.js` calls LinkedIn
  Voyager (invite or DM) with the page session + CSRF token.
- Results go to `POST /api/li/ack`; the dashboard marks steps sent / failed.
- Spacing: 15–35s between actions. Server daily cap: **20** LinkedIn actions/day.
- **Human-hours gate:** pulls still run, but execution only fires locally between
  **08:00–20:00**. Outside that window, actions stay queued.
- If LinkedIn shows a security checkpoint, the extension stops, flags
  `checkpoint` on the connection, and the dashboard asks you to re-login. After
  you clear it, the next poll resumes.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 permissions, hosts, service worker, content script |
| `background.js` | Poll / pace / ack; human-hours + checkpoint handling |
| `content.js` | Voyager invite + DM (`resolveProfileId`, `sendInvite`, `sendMessage`) |
| `popup.html` / `popup.js` | Pairing UI, status, **Run now** |

## Maintenance

LinkedIn's Voyager API is undocumented and changes periodically. If invites/DMs
start failing, update the Voyager helpers in `content.js` — that is the only
surface that depends on LinkedIn internals. Pull/ack contracts live under
`app/api/li/`.

## Safety

Automating LinkedIn violates its Terms of Service and can get accounts
restricted. Keep daily volumes low, personalize messages, and pause if LinkedIn
shows any security prompts.
