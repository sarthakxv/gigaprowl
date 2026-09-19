// Single-use, expiring tokens for email verification + password reset.
// Stored in KV with a TTL so they self-destruct; consumed once then deleted.
import crypto from "crypto";
import { kvSetEx, kvGetRaw, kvDel } from "@/lib/db";
import { TOKEN_TTL_SEC, kvKeys, appUrl } from "@/lib/constants";

export { appUrl };

export async function createToken(kind, { userId, email }) {
  const token = crypto.randomBytes(32).toString("hex");
  await kvSetEx(kvKeys.token(token), { kind, userId, email, at: Date.now() }, TOKEN_TTL_SEC[kind] || 3600);
  return token;
}

// Read without consuming (for GET landing pages that validate before showing a form).
export async function peekToken(token, kind) {
  if (!token) return null;
  const rec = await kvGetRaw(kvKeys.token(token));
  if (!rec || rec.kind !== kind) return null;
  return rec;
}

// Read AND delete. Use when the token is actually spent (verify / reset).
export async function consumeToken(token, kind) {
  const rec = await peekToken(token, kind);
  if (rec) await kvDel(kvKeys.token(token));
  return rec;
}
