// Single-use, expiring tokens for email verification + password reset.
// Stored in KV with a TTL so they self-destruct; consumed once then deleted.
import crypto from "crypto";
import { kvSetEx, kvGetRaw, kvDel } from "@/lib/db";

const TTL = {
  verify: 60 * 60 * 24 * 3, // 3 days to confirm an email
  reset: 60 * 60,           // 1 hour to reset a password
};

// The public base URL of the app. Set APP_URL in prod (e.g. https://gigaprowl.com).
export function appUrl() {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://prowl-livid.vercel.app";
  return u.replace(/\/$/, "");
}

export async function createToken(kind, { userId, email }) {
  const token = crypto.randomBytes(32).toString("hex");
  await kvSetEx(`prowl:tok:${token}`, { kind, userId, email, at: Date.now() }, TTL[kind] || 3600);
  return token;
}

// Read without consuming (for GET landing pages that validate before showing a form).
export async function peekToken(token, kind) {
  if (!token) return null;
  const rec = await kvGetRaw(`prowl:tok:${token}`);
  if (!rec || rec.kind !== kind) return null;
  return rec;
}

// Read AND delete — use when the token is actually spent (verify / reset).
export async function consumeToken(token, kind) {
  const rec = await peekToken(token, kind);
  if (rec) await kvDel(`prowl:tok:${token}`);
  return rec;
}
