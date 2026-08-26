// Multi-tenant KV store. Redis (Upstash REST) in prod; JSON files for local dev.
import fs from "fs";
import path from "path";

export const DATA_DIR = process.env.VERCEL
  ? "/tmp/prowl-data"
  : path.join(process.cwd(), "data");
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// ---------- low-level KV ----------
export async function kvGet(key) {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        cache: "no-store",
      });
      const { result } = await r.json();
      return result ? JSON.parse(result) : null;
    } catch (e) {
      console.error("kv get failed:", key, e.message);
      return null;
    }
  }
  try {
    const file = path.join(DATA_DIR, key.replace(/[^a-z0-9_.-]/gi, "_") + ".json");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export async function kvSet(key, value) {
  if (REDIS_URL && REDIS_TOKEN) {
    const r = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      body: JSON.stringify(value),
    });
    if (!r.ok) throw new Error(`kv set failed: ${r.status}`);
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, key.replace(/[^a-z0-9_.-]/gi, "_") + ".json");
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// Generic Redis command via Upstash REST (POST a JSON array to the base URL).
// Returns the raw `result`. In file-dev mode, a small shim covers what we need.
export async function kvCmd(args) {
  if (REDIS_URL && REDIS_TOKEN) {
    const r = await fetch(REDIS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`kv cmd failed: ${r.status} ${JSON.stringify(d).slice(0, 120)}`);
    return d.result;
  }
  // ---- dev/file shim (no TTL enforcement; good enough for local dev) ----
  const [cmd, key, value, , ttl] = args;
  const c = String(cmd).toUpperCase();
  if (c === "SET") { await kvSet(key, value); return "OK"; }
  if (c === "GET") { return JSON.stringify(await kvGet(key)); }
  if (c === "DEL") { try { fs.unlinkSync(path.join(DATA_DIR, key.replace(/[^a-z0-9_.-]/gi, "_") + ".json")); } catch {} return 1; }
  if (c === "INCR") { const n = (await kvGet(key)) || 0; const v = Number(n) + 1; await kvSet(key, v); return v; }
  if (c === "EXPIRE") { return 1; }
  return null;
}

// Set a JSON value with a TTL (seconds). Used for single-use email tokens.
export async function kvSetEx(key, value, ttlSeconds) {
  await kvCmd(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
}

export async function kvGetRaw(key) {
  const r = await kvCmd(["GET", key]);
  if (r == null) return null;
  try { return JSON.parse(typeof r === "string" ? r : JSON.stringify(r)); } catch { return null; }
}

export async function kvDel(key) {
  await kvCmd(["DEL", key]);
}

// ---------- email suppression list (bounces / complaints / unsubscribes) ----------
// A hard bounce or spam complaint means we must never email that address again.
export async function isSuppressed(email) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  return !!(await kvGet(`prowl:suppress:${e}`));
}
export async function addSuppression(email, reason) {
  if (!email) return;
  const e = String(email).toLowerCase().trim();
  await kvSet(`prowl:suppress:${e}`, { reason: reason || "bounce", at: new Date().toISOString() });
}

// ---------- per-user daily send caps (abuse + deliverability protection) ----------
// Returns { count, allowed } after incrementing. Keyed per UTC day, auto-expires.
export async function bumpDailyCounter(userId, kind, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `prowl:rate:${kind}:${userId}:${day}`;
  const count = Number(await kvCmd(["INCR", key])) || 1;
  if (count === 1) await kvCmd(["EXPIRE", key, "172800"]); // keep ~2 days
  return { count, allowed: count <= limit };
}
export async function peekDailyCounter(userId, kind) {
  const day = new Date().toISOString().slice(0, 10);
  return Number(await kvGet(`prowl:rate:${kind}:${userId}:${day}`)) || 0;
}

// ---------- sliding-window rate limiter (per IP, per action) ----------
// Fixed-window counter: INCR a key that expires after windowSec. Cheap + good
// enough to stop credential-stuffing / signup spam at the edge.
export async function rateLimit(bucket, id, limit, windowSec) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = `prowl:rl:${bucket}:${id}:${win}`;
  const count = Number(await kvCmd(["INCR", key])) || 1;
  if (count === 1) await kvCmd(["EXPIRE", key, String(windowSec)]);
  return { count, allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

// ---------- users ----------
export async function getUserByEmail(email) {
  return kvGet(`prowl:user:${email.toLowerCase().trim()}`);
}

export async function saveUser(user) {
  const email = user.email.toLowerCase().trim();
  await kvSet(`prowl:user:${email}`, user);
  if (user.id) await kvSet(`prowl:uid2email:${user.id}`, email); // reverse index
}

// Look a user up by their session userId (via the reverse index).
export async function getUserById(userId) {
  const email = await kvGet(`prowl:uid2email:${userId}`);
  return email ? getUserByEmail(email) : null;
}

// Registry of all userIds so the scheduler cron can iterate every user
// (per-user state is keyed by userId, with no other index).
const USERS_KEY = "prowl:users";
export async function addUserId(userId) {
  const list = (await kvGet(USERS_KEY)) || [];
  if (!list.includes(userId)) { list.push(userId); await kvSet(USERS_KEY, list); }
}
export async function getAllUserIds() {
  return (await kvGet(USERS_KEY)) || [];
}

// ---------- per-user state ----------
const EMPTY_STATE = {
  profile: null,
  media: { facePhoto: null, voiceSample: null }, // consented uploads
  statusById: {}, // matchId -> "outreach_ready" etc.
  contacts: [],
  cadences: [],
  pitchRefs: [], // slugs of this user's pitch pages
  applyKits: [], // lite hunts: tailored bullets + apply note (0 credits)
  socialPosts: [], // signal boost: LinkedIn post + X thread per top-account hunt
  credits: { plan: "free", balance: 5, used: 0 },
  // Connected outreach channels. gmail = send-as via Google OAuth;
  // linkedin = our own browser-extension engine (session runs in the user's
  // own browser; the cookie never touches our server).
  connections: {
    gmail: null,    // { email, refreshToken, connectedAt }
    linkedin: null, // { method:"extension", pairedAt, lastSeen, name }
  },
  // Pending LinkedIn actions the paired extension pulls & executes browser-side.
  // Each: { id, type:"invite"|"message", identifier, message, cadenceId, stepIndex, status, result, at }
  linkedinQueue: [],
  sends: [], // log of dispatched cadence steps: { id, matchId, channel, to, status, at }
  // Outreach mode: "manual" = emails saved as Gmail drafts for the user to
  // review + send; "automated" = Gigaprowl sends them directly. Default safe.
  // emailStyle: "standard" (pitch-page-led) | "founder_direct" (short cold
  // email straight to founders, Backdoor-style).
  settings: { outreachMode: "manual", emailStyle: "standard" },
};

export async function getUserState(userId) {
  const s = await kvGet(`prowl:u:${userId}`);
  return { ...structuredClone(EMPTY_STATE), ...(s || {}) };
}

export async function updateUserState(userId, fn) {
  const state = await getUserState(userId);
  const result = fn(state);
  await kvSet(`prowl:u:${userId}`, state);
  return result ?? state;
}

// ---------- global job pool (shared across users, cron-refreshed) ----------
export async function getJobPool() {
  return (await kvGet("prowl:jobs")) || { jobs: [], lastSync: null };
}

export async function setJobPool(pool) {
  await kvSet("prowl:jobs", pool);
}

// ---------- LinkedIn account ownership (multi-tenant safety) ----------
// One Unipile API key hosts every user's connected LinkedIn account, so we must
// bind each account_id to exactly one Gigaprowl user and never reassign it.
export async function getLinkedInOwner(accountId) {
  return kvGet(`prowl:liowner:${accountId}`);
}
export async function claimLinkedInAccount(accountId, userId) {
  const existing = await kvGet(`prowl:liowner:${accountId}`);
  if (existing && existing !== userId) return false; // owned by someone else
  await kvSet(`prowl:liowner:${accountId}`, userId);
  return true;
}

// ---------- public pitch pages ----------
export async function getPitch(slug) {
  return kvGet(`prowl:pitch:${slug}`);
}

export async function savePitch(slug, pitch) {
  await kvSet(`prowl:pitch:${slug}`, pitch);
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
