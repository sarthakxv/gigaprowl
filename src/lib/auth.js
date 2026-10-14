import crypto from "crypto";
import { cookies } from "next/headers.js";
import { createServerClient } from "@supabase/ssr";
import { ensureAccount } from "@/lib/durable";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured");
  return { url, key };
}

export function serverAuth() {
  const { url, key } = config();
  const store = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; middleware refreshes them.
        }
      },
    },
  });
}

// Accounts are provisioned at sign-in (auth/callback). Sessions that predate
// that, or a failed provisioning there, are caught by requireUser once per
// server process; later requests skip the write. Nothing deletes accounts, so
// a remembered ID cannot go stale. Clear it here if that ever changes.
const provisioned = new Set();

export async function provisionAccount(user) {
  await ensureAccount(user);
  provisioned.add(user.id);
}

export async function requireUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const { data, error } = await serverAuth().auth.getUser();
  if (error || !data.user?.email_confirmed_at) return null;
  if (!provisioned.has(data.user.id)) await provisionAccount(data.user);
  return data.user;
}

export async function getUserId() {
  const user = await requireUser();
  return user?.id || null;
}

// OAuth state is single-use and also contains the verified user ID. It should
// survive an access-token refresh while the user completes provider consent.
export async function getSessionBinding(verifiedUserId) {
  const userId = verifiedUserId || (await requireUser())?.id;
  return userId ? crypto.createHash("sha256").update(userId).digest("base64url") : null;
}
