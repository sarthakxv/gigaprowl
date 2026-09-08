// Gmail send-as via Google OAuth. Outreach goes out from the user's Gmail
// address (drafts in manual mode, send in automated). Account login stays
// email/password — this is not Google Sign-In.
//
// Scope is gmail.compose only (send + drafts, no inbox read) plus OIDC
// openid/email so we can store a verified identity. Refresh tokens are
// encrypted at rest; access and ID tokens are never persisted.
import crypto from "crypto";
import { kvSetEx, kvTake, updateUserState, getUserState } from "@/lib/db";
import {
  GMAIL_COMPOSE_SCOPE,
  GMAIL_SCOPES,
  GMAIL_OAUTH_STATE_TTL_SEC,
  GMAIL_TOKEN_VERSION,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  GOOGLE_REVOKE_URL,
  GMAIL_API_BASE,
  EMAIL_RE,
  kvKeys,
  appUrl,
  googleRedirectUri,
} from "@/lib/constants";

export {
  GMAIL_COMPOSE_SCOPE,
  GMAIL_SCOPES,
  appUrl as oauthAppBase,
  googleRedirectUri as redirectUri,
};

export function gmailEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_TOKEN_ENCRYPTION_KEY);
}

export class GmailError extends Error {
  constructor(code, message, { retryable = false, reauth = false } = {}) {
    super(message);
    this.name = "GmailError";
    this.code = code;
    this.retryable = retryable;
    this.reauth = reauth;
  }
}

export function googleAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${p}`;
}

export function gmailDashboardPath(connect) {
  return `/dashboard?connect=${connect}`;
}

export function gmailDashboardUrl(connect) {
  return new URL(gmailDashboardPath(connect), `${appUrl()}/`).toString();
}

// ---------- OAuth state (single-use nonce, 10 minutes, bound to session) ----------
export async function createGoogleOAuthState(userId, sessionBinding) {
  if (!userId || !sessionBinding) throw new GmailError("bad_state", "A signed-in session is required");
  const token = crypto.randomBytes(32).toString("hex");
  await kvSetEx(
    kvKeys.oauthGoogle(token),
    { userId, sessionBinding, at: Date.now() },
    GMAIL_OAUTH_STATE_TTL_SEC,
  );
  return token;
}

export async function consumeGoogleOAuthState(token, sessionBinding) {
  if (!token || !sessionBinding) return null;
  const rec = await kvTake(kvKeys.oauthGoogle(token));
  if (!rec || !rec.userId || !rec.sessionBinding) return null;
  if (rec.sessionBinding !== sessionBinding) return null;
  const ageMs = Date.now() - Number(rec.at);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > GMAIL_OAUTH_STATE_TTL_SEC * 1000) return null;
  return rec;
}

// ---------- token encryption ----------
export function parseEncryptionKey(raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY) {
  if (!raw) throw new GmailError("storage", "GMAIL_TOKEN_ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch { /* fall through */ }
  throw new GmailError("storage", "GMAIL_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
}

export function encryptRefreshToken(plaintext, key = parseEncryptionKey()) {
  if (!plaintext) throw new GmailError("storage", "Missing refresh token");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return {
    version: GMAIL_TOKEN_VERSION,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptRefreshToken(blob, key = parseEncryptionKey()) {
  if (!blob || blob.version !== GMAIL_TOKEN_VERSION || !blob.iv || !blob.tag || !blob.ciphertext) {
    throw new GmailError("reauth_required", "Reconnect Gmail", { reauth: true });
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new GmailError("reauth_required", "Reconnect Gmail", { reauth: true });
  }
}

export function isLegacyGmailConnection(gmail) {
  return !!(gmail && gmail.refreshToken && !gmail.encryptedRefreshToken);
}

export function publicGmailConnection(gmail) {
  if (!gmail) return null;
  const legacy = isLegacyGmailConnection(gmail);
  const status = legacy ? "reauth_required" : (gmail.status || "connected");
  return {
    email: gmail.email || null,
    status,
    connectedAt: gmail.connectedAt || null,
    lastValidatedAt: gmail.lastValidatedAt || null,
    reconnectRequired: legacy || status === "reauth_required" || !gmail.encryptedRefreshToken,
  };
}

export function gmailUsable(gmail) {
  const pub = publicGmailConnection(gmail);
  return !!(pub && !pub.reconnectRequired && gmail?.encryptedRefreshToken);
}

export function refreshTokenFromConnection(gmail, { ignoreStatus = false } = {}) {
  if (!gmail || isLegacyGmailConnection(gmail) || !gmail.encryptedRefreshToken) {
    throw new GmailError("reauth_required", "Reconnect Gmail", { reauth: true });
  }
  if (!ignoreStatus && gmail.status === "reauth_required") {
    throw new GmailError("reauth_required", "Reconnect Gmail", { reauth: true });
  }
  return decryptRefreshToken(gmail.encryptedRefreshToken);
}

export function hasGmailComposeScope(scope) {
  return String(scope || "").split(/\s+/).includes(GMAIL_COMPOSE_SCOPE);
}

// ---------- identity + token exchange ----------
function flattenGoogleError(d) {
  if (!d) return "";
  if (typeof d.error === "string") return `${d.error} ${d.error_description || ""}`;
  if (d.error && typeof d.error === "object") return `${d.error.status || ""} ${d.error.message || ""} ${d.error.code || ""}`;
  return String(d.message || "");
}

export function classifyGoogleError(status, d, fallback) {
  const combined = flattenGoogleError(d).toLowerCase();
  if (combined.includes("invalid_grant") || combined.includes("invalid_token") || combined.includes("token has been expired or revoked") || combined.includes("revoked") || status === 401) {
    return new GmailError("reauth_required", "Gmail access was revoked. Reconnect Gmail.", { reauth: true });
  }
  if (combined.includes("insufficient") || combined.includes("accessnotconfigured") || (status === 403 && combined.includes("scope"))) {
    return new GmailError("insufficient_scope", "Gmail is missing the compose permission. Reconnect Gmail.", { reauth: true });
  }
  if (status === 429 || status >= 500) {
    return new GmailError("transient", fallback, { retryable: true });
  }
  return new GmailError("error", fallback);
}

async function fetchGoogle(url, opts = {}, { timeoutMs = 15000, retries = 2, mutation = false } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { ...opts, signal: ctrl.signal });
      if ((r.status === 429 || (r.status >= 500 && r.status <= 599)) && attempt < retries) {
        await r.arrayBuffer().catch(() => {});
        const ra = Number(r.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : 400 * (2 ** attempt);
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (mutation) {
        throw new GmailError(
          "delivery_uncertain",
          "Google may have accepted this message. Check Gmail before trying again.",
        );
      }
      if (attempt === retries) {
        throw new GmailError("transient", e?.name === "AbortError" ? "Google request timed out" : "Google request failed", { retryable: true });
      }
      await new Promise((res) => setTimeout(res, 400 * (2 ** attempt)));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

export async function exchangeCode(code) {
  const r = await fetchGoogle(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  }, { retries: 0 });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw classifyGoogleError(r.status, d, "Google token exchange failed");
  if (!d.refresh_token) throw new GmailError("no_refresh", "Google didn't return a refresh token");
  if (!hasGmailComposeScope(d.scope)) {
    throw new GmailError("insufficient_scope", "Gmail compose permission was not granted", { reauth: true });
  }
  const info = await fetchUserInfo(d.access_token);
  const emailVerified = info.email_verified === true || info.email_verified === "true";
  if (!info.email || !info.sub) throw new GmailError("error", "Google did not return a verified account identity");
  if (!emailVerified) throw new GmailError("unverified", "That Google account's email is not verified");
  return {
    refreshToken: d.refresh_token,
    email: String(info.email).toLowerCase(),
    googleSub: String(info.sub),
    grantedScopes: String(d.scope || "").split(/\s+/).filter(Boolean),
  };
}

async function fetchUserInfo(accessToken) {
  const r = await fetchGoogle(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, { retries: 1 });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw classifyGoogleError(r.status, d, "Google user info failed");
  return d;
}

export async function freshAccessToken(refreshToken) {
  const r = await fetchGoogle(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  }, { retries: 1 });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw classifyGoogleError(r.status, d, "Google token refresh failed");
  if (!d.access_token) throw new GmailError("reauth_required", "Google didn't return an access token", { reauth: true });
  return d.access_token;
}

export async function revokeGoogleToken(token) {
  if (!token) return;
  try {
    await fetchGoogle(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }, { retries: 0, timeoutMs: 8000 });
  } catch {
    // Disconnect always proceeds locally even if Google is unreachable.
  }
}

// ---------- connection records ----------
export async function saveGmailConnection(userId, { email, googleSub, refreshToken, grantedScopes }) {
  let encryptedRefreshToken;
  try {
    encryptedRefreshToken = encryptRefreshToken(refreshToken);
  } catch (e) {
    throw e instanceof GmailError ? e : new GmailError("storage", "Could not store the Gmail grant");
  }
  const now = new Date().toISOString();
  await updateUserState(userId, (s) => {
    s.connections.gmail = {
      email,
      googleSub,
      encryptedRefreshToken,
      grantedScopes: grantedScopes || [GMAIL_COMPOSE_SCOPE],
      status: "connected",
      connectedAt: now,
      lastValidatedAt: now,
      lastErrorCode: null,
    };
  });
}

export async function clearGmailConnection(userId) {
  await updateUserState(userId, (s) => {
    s.connections.gmail = null;
  });
}

export async function markGmailStatus(userId, status, lastErrorCode = null) {
  await updateUserState(userId, (s) => {
    if (!s.connections?.gmail) return;
    s.connections.gmail.status = status;
    s.connections.gmail.lastErrorCode = lastErrorCode;
  });
}

export async function markGmailError(userId, lastErrorCode) {
  await updateUserState(userId, (s) => {
    if (!s.connections?.gmail) return;
    s.connections.gmail.lastErrorCode = lastErrorCode;
  });
}

export async function touchGmailValidated(userId) {
  await updateUserState(userId, (s) => {
    if (!s.connections?.gmail) return;
    s.connections.gmail.status = "connected";
    s.connections.gmail.lastValidatedAt = new Date().toISOString();
    s.connections.gmail.lastErrorCode = null;
  });
}

export async function plaintextRefreshTokenFor(gmail) {
  if (!gmail) return null;
  if (gmail.encryptedRefreshToken) {
    try { return decryptRefreshToken(gmail.encryptedRefreshToken); } catch { return null; }
  }
  if (isLegacyGmailConnection(gmail)) return gmail.refreshToken;
  return null;
}

export async function validateGmailConnection(gmail) {
  const refreshToken = refreshTokenFromConnection(gmail, { ignoreStatus: true });
  const accessToken = await freshAccessToken(refreshToken);
  const r = await fetchGoogle(`${GMAIL_API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, { retries: 1 });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw classifyGoogleError(r.status, d, "Gmail health check failed");
  }
  return true;
}

export async function disconnectGmail(userId) {
  const state = await getUserState(userId);
  const gmail = state.connections?.gmail;
  const token = await plaintextRefreshTokenFor(gmail);
  await revokeGoogleToken(token);
  await clearGmailConnection(userId);
}

// ---------- MIME + send/draft ----------
export function assertValidRecipient(email) {
  const e = String(email || "").trim();
  if (!EMAIL_RE.test(e) || /[\r\n]/.test(e) || e.length > 254) {
    throw new GmailError("invalid_recipient", "Invalid recipient email");
  }
  return e;
}

export function encodeHeaderValue(value) {
  const s = String(value || "").replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

export function buildRaw({ from, fromName, to, subject, body }) {
  const safeTo = assertValidRecipient(to);
  const safeFrom = assertValidRecipient(from);
  const display = fromName ? `${encodeHeaderValue(fromName)} <${safeFrom}>` : safeFrom;
  const headers = [
    `From: ${display}`,
    `To: ${safeTo}`,
    `Subject: ${encodeHeaderValue(subject || "")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body || ""}`).toString("base64url");
}

async function gmailApi(path, { refreshToken, body }) {
  const accessToken = await freshAccessToken(refreshToken);
  const r = await fetchGoogle(`${GMAIL_API_BASE}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, { retries: 0, mutation: true });
  const d = await r.json().catch(() => ({}));
  if (r.status >= 500) {
    throw new GmailError(
      "delivery_uncertain",
      "Google may have accepted this message. Check Gmail before trying again.",
    );
  }
  if (!r.ok) throw classifyGoogleError(r.status, d, path.includes("drafts") ? "Gmail draft failed" : "Gmail send failed");
  return d;
}

export async function sendGmail({ refreshToken, from, fromName, to, subject, body }) {
  const raw = buildRaw({ from, fromName, to, subject, body });
  const d = await gmailApi("messages/send", { refreshToken, body: { raw } });
  return d.id;
}

export async function createDraft({ refreshToken, from, fromName, to, subject, body }) {
  const raw = buildRaw({ from, fromName, to, subject, body });
  const d = await gmailApi("drafts", { refreshToken, body: { message: { raw } } });
  return d.id;
}
