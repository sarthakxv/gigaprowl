// Expiring KV only; durable product state is in Postgres.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { kvKeys, OUTREACH_LOCK_TTL_SEC } from "@/lib/constants";
import {
  getAccount, allAccountIds, readUserState, mutateUserState, readJobPool,
  writeJobPool, readPitch, writePitch, readLinkedInOwner,
  claimLinkedInOwner, releaseLinkedInOwner, suppressed, suppress,
} from "@/lib/durable";

export const DATA_DIR = process.env.VERCEL
  ? "/tmp/prowl-data"
  : path.join(process.cwd(), "data");
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const fileKvAllowed = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

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
  if (!fileKvAllowed) return null;
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
  if (!fileKvAllowed) throw new Error("KV is not configured");
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
  if (!fileKvAllowed) throw new Error("KV is not configured");
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
  if (!fileKvAllowed) throw new Error("KV is not configured");
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
  return suppressed(String(email));
}
export async function addSuppression(email, reason) {
  if (!email) return;
  await suppress(String(email), reason || "bounce");
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
  if (!fileKvAllowed) throw new Error("KV is not configured");
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

// ---------- durable state facade ----------
export async function getUserById(userId) {
  return getAccount(userId);
}

export async function getAllUserIds() {
  return allAccountIds();
}

export async function getUserState(userId) {
  return readUserState(userId);
}

export async function updateUserState(userId, fn, options) {
  return mutateUserState(userId, fn, options);
}

// ---------- global job pool (shared across users, cron-refreshed) ----------
export async function getJobPool() {
  return readJobPool();
}

export async function setJobPool(pool) {
  await writeJobPool(pool);
}

// ---------- LinkedIn account ownership (multi-tenant safety) ----------
// One Unipile API key hosts every user's connected LinkedIn account, so we must
// bind each account_id to exactly one Gigaprowl user and never reassign it.
export async function getLinkedInOwner(accountId) {
  return readLinkedInOwner(accountId);
}
export async function claimLinkedInAccount(accountId, userId) {
  return claimLinkedInOwner(accountId, userId);
}
export async function releaseLinkedInAccount(accountId, userId) {
  return releaseLinkedInOwner(accountId, userId);
}

// ---------- public pitch pages ----------
export async function getPitch(slug) {
  return readPitch(slug);
}

export async function savePitch(slug, pitch) {
  await writePitch(slug, pitch);
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
