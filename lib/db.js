// Multi-tenant KV store. Redis (Upstash REST) in prod; JSON files for local dev.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { kvKeys, OUTREACH_LOCK_TTL_SEC } from "@/lib/constants";

export const DATA_DIR = process.env.VERCEL
  ? "/tmp/prowl-data"
  : path.join(process.cwd(), "data");
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function fileForKey(key) {
  return path.join(DATA_DIR, key.replace(/[^a-z0-9_.-]/gi, "_") + ".json");
}

// Upstash REST sometimes returns JSON values already parsed, sometimes as a
// string. JSON.parse(object) throws and used to look like a missing profile.
export function decodeKvResult(result) {
  if (result == null || result === "") return null;
  if (typeof result === "object") return result;
  if (typeof result !== "string") return result;
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed === "string") {
      try { return JSON.parse(parsed); } catch { return parsed; }
    }
    return parsed;
  } catch {
    return result;
  }
}

// ---------- low-level KV ----------
export async function kvGet(key) {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        cache: "no-store",
      });
      const { result } = await r.json();
      return decodeKvResult(result);
    } catch (e) {
      console.error("kv get failed:", key, e.message);
      return null;
    }
  }
  try {
    const file = fileForKey(key);
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
  const file = fileForKey(key);
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

// Set a JSON value with a TTL (seconds). Used for single-use email + OAuth tokens.
export async function kvSetEx(key, value, ttlSeconds) {
  if (REDIS_URL && REDIS_TOKEN) {
    await kvCmd(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
    return;
  }
  await kvSet(key, value);
}

export async function kvGetRaw(key) {
  if (REDIS_URL && REDIS_TOKEN) {
    return decodeKvResult(await kvCmd(["GET", key]));
  }
  return kvGet(key);
}

// Atomically read and remove a single-use value. Redis GETDEL and the local
// rename claim both ensure concurrent consumers cannot receive the same value.
export async function kvTake(key) {
  if (REDIS_URL && REDIS_TOKEN) {
    return decodeKvResult(await kvCmd(["GETDEL", key]));
  }
  const file = fileForKey(key);
  const claim = `${file}.${process.pid}.${uid("take")}.claim`;
  try {
    fs.renameSync(file, claim);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  try {
    return JSON.parse(fs.readFileSync(claim, "utf8"));
  } finally {
    try { fs.unlinkSync(claim); } catch {}
  }
}

export async function kvDel(key) {
  await kvCmd(["DEL", key]);
}

// ---------- email suppression list (bounces / complaints / unsubscribes) ----------
// A hard bounce or spam complaint means we must never email that address again.
export async function isSuppressed(email) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  return !!(await kvGet(kvKeys.suppress(e)));
}
export async function addSuppression(email, reason) {
  if (!email) return;
  const e = String(email).toLowerCase().trim();
  await kvSet(kvKeys.suppress(e), { reason: reason || "bounce", at: new Date().toISOString() });
}

// ---------- per-user daily send caps (abuse + deliverability protection) ----------
// Returns { count, allowed } after incrementing. Keyed per UTC day, auto-expires.
export async function bumpDailyCounter(userId, kind, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const key = kvKeys.rate(kind, userId, day);
  const count = Number(await kvCmd(["INCR", key])) || 1;
  if (count === 1) await kvCmd(["EXPIRE", key, "172800"]); // keep ~2 days
  return { count, allowed: count <= limit };
}
export async function peekDailyCounter(userId, kind) {
  const day = new Date().toISOString().slice(0, 10);
  return Number(await kvGet(kvKeys.rate(kind, userId, day))) || 0;
}

// SET NX EX lock. The returned owner token must be supplied on release so an
// expired worker can never delete a newer worker's lease.
export async function acquireLock(key, ttlSeconds = OUTREACH_LOCK_TTL_SEC) {
  const owner = crypto.randomUUID();
  if (REDIS_URL && REDIS_TOKEN) {
    const r = await kvCmd(["SET", key, owner, "NX", "EX", String(ttlSeconds)]);
    return r === "OK" ? owner : null;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = fileForKey(key);
  try {
    if (fs.existsSync(file)) {
      try {
        const rec = JSON.parse(fs.readFileSync(file, "utf8"));
        if (rec.exp && rec.exp < Date.now()) {
          try { fs.unlinkSync(file); } catch {}
        }
        else return null;
      } catch {
        return null;
      }
    }
    const fd = fs.openSync(file, "wx");
    try {
      fs.writeFileSync(fd, JSON.stringify({ owner, at: Date.now(), exp: Date.now() + ttlSeconds * 1000 }));
    } finally {
      fs.closeSync(fd);
    }
    return owner;
  } catch (e) {
    if (e.code === "EEXIST") return null;
    throw e;
  }
}

export async function releaseLock(key, owner) {
  if (!owner) return false;
  if (REDIS_URL && REDIS_TOKEN) {
    const script = 'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';
    return Number(await kvCmd(["EVAL", script, "1", key, owner])) === 1;
  }
  const file = fileForKey(key);
  try {
    const rec = JSON.parse(fs.readFileSync(file, "utf8"));
    if (rec.owner !== owner) return false;
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

// ---------- sliding-window rate limiter (per IP, per action) ----------
// Fixed-window counter: INCR a key that expires after windowSec. Cheap + good
// enough to stop credential-stuffing / signup spam at the edge.
export async function rateLimit(bucket, id, limit, windowSec) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = kvKeys.rateLimit(bucket, id, win);
  const count = Number(await kvCmd(["INCR", key])) || 1;
  if (count === 1) await kvCmd(["EXPIRE", key, String(windowSec)]);
  return { count, allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

// ---------- users ----------
export async function getUserByEmail(email) {
  return kvGet(kvKeys.user(email.toLowerCase().trim()));
}

export async function saveUser(user) {
  const email = user.email.toLowerCase().trim();
  await kvSet(kvKeys.user(email), user);
  if (user.id) await kvSet(kvKeys.uidToEmail(user.id), email); // reverse index
}

// Look a user up by their session userId (via the reverse index).
export async function getUserById(userId) {
  const email = await kvGet(kvKeys.uidToEmail(userId));
  return email ? getUserByEmail(email) : null;
}

// Registry of all userIds so the scheduler cron can iterate every user
// (per-user state is keyed by userId, with no other index).
const USERS_KEY = kvKeys.users;
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
    gmail: null,    // { email, googleSub, encryptedRefreshToken, grantedScopes, status, connectedAt, lastValidatedAt, lastErrorCode }
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

function nest(base, extra) {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return { ...base };
  return { ...base, ...extra };
}

export async function getUserState(userId) {
  const s = await kvGet(kvKeys.userState(userId));
  const base = structuredClone(EMPTY_STATE);
  if (!s || typeof s !== "object" || Array.isArray(s)) return base;
  return {
    ...base,
    ...s,
    media: nest(base.media, s.media),
    connections: nest(base.connections, s.connections),
    settings: nest(base.settings, s.settings),
    credits: nest(base.credits, s.credits),
  };
}

export async function updateUserState(userId, fn) {
  const state = await getUserState(userId);
  const result = fn(state);
  await kvSet(kvKeys.userState(userId), state);
  return result ?? state;
}

// ---------- global job pool (shared across users, cron-refreshed) ----------
export async function getJobPool() {
  const pool = await kvGet(kvKeys.jobs);
  if (!pool || typeof pool !== "object" || Array.isArray(pool)) return { jobs: [], lastSync: null };
  return { jobs: Array.isArray(pool.jobs) ? pool.jobs : [], lastSync: pool.lastSync || null, sources: pool.sources };
}

export async function setJobPool(pool) {
  await kvSet(kvKeys.jobs, pool);
}

// ---------- LinkedIn account ownership (multi-tenant safety) ----------
// One Unipile API key hosts every user's connected LinkedIn account, so we must
// bind each account_id to exactly one Gigaprowl user and never reassign it.
export async function getLinkedInOwner(accountId) {
  return kvGet(kvKeys.linkedInOwner(accountId));
}
export async function claimLinkedInAccount(accountId, userId) {
  const existing = await kvGet(kvKeys.linkedInOwner(accountId));
  if (existing && existing !== userId) return false; // owned by someone else
  await kvSet(kvKeys.linkedInOwner(accountId), userId);
  return true;
}
export async function releaseLinkedInAccount(accountId, userId) {
  const existing = await kvGet(kvKeys.linkedInOwner(accountId));
  if (existing && existing !== userId) return false;
  await kvDel(kvKeys.linkedInOwner(accountId));
  return true;
}

// ---------- public pitch pages ----------
export async function getPitch(slug) {
  return kvGet(kvKeys.pitch(slug));
}

export async function savePitch(slug, pitch) {
  await kvSet(kvKeys.pitch(slug), pitch);
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
