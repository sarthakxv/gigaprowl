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

export async function requireUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const { data, error } = await serverAuth().auth.getUser();
  if (error || !data.user?.email_confirmed_at) return null;
  await ensureAccount(data.user);
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
