// Gmail send-as via Google OAuth. One-click connect; outreach then goes out
// from the user's REAL Gmail address (best deliverability + authenticity).
// We only ever request gmail.send. No inbox read access.

// gmail.compose covers BOTH sending and creating/updating drafts (no inbox
// read access). This lets Gigaprowl either send outreach or drop it in the user's
// Drafts folder for them to review + send themselves.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "openid",
  "email",
  "profile",
].join(" ");

export function gmailEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(base) {
  return `${base}/api/connect/google/callback`;
}

// Google consent screen URL. `state` ties the callback back to our user.
export function googleAuthUrl(base, state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(base),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

function decodeJwt(t) {
  try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()); } catch { return {}; }
}

// Exchange the auth code for tokens + the connected email address.
export async function exchangeCode(base, code) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(base),
      grant_type: "authorization_code",
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(d).slice(0, 200)}`);
  const email = decodeJwt(d.id_token || "").email || null;
  return { refreshToken: d.refresh_token, accessToken: d.access_token, email };
}

async function freshAccessToken(refreshToken) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Google token refresh failed: ${JSON.stringify(d).slice(0, 200)}`);
  return d.access_token;
}

// RFC 2822 message → base64url, the format Gmail's messages.send expects.
function buildRaw({ from, fromName, to, subject, body }) {
  const headers = [
    `From: ${fromName ? `${fromName} <${from}>` : from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  const mime = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(mime).toString("base64url");
}

// Send one email as the connected user. Returns the Gmail message id.
export async function sendGmail({ refreshToken, from, fromName, to, subject, body }) {
  const accessToken = await freshAccessToken(refreshToken);
  const raw = buildRaw({ from, fromName, to, subject, body });
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Gmail send failed: ${JSON.stringify(d).slice(0, 200)}`);
  return d.id;
}

// Save the email as a DRAFT in the user's Gmail (manual mode). They review it
// in their own Drafts folder and hit send. Returns the draft id.
export async function createDraft({ refreshToken, from, fromName, to, subject, body }) {
  const accessToken = await freshAccessToken(refreshToken);
  const raw = buildRaw({ from, fromName, to, subject, body });
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Gmail draft failed: ${JSON.stringify(d).slice(0, 200)}`);
  return d.id;
}
