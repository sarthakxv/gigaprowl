import { NextResponse } from "next/server";
import { getUserId, serverAuth } from "@/lib/auth";
import { unpairExtension } from "@/lib/extension-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A database outage must not keep a user signed in. Sessions end regardless;
// a failed pairing revocation is reported so the client can retry.
// Only this browser's session ends; other devices stay signed in. Extension
// credentials are not tied to a session, so every paired extension is revoked.
export async function POST() {
  let revoked = true;
  try {
    const userId = await getUserId();
    if (userId) await unpairExtension(userId);
  } catch (error) {
    revoked = false;
    console.error("extension revocation failed:", error.message);
  }
  let signedOut = false;
  try {
    signedOut = !(await serverAuth().auth.signOut({ scope: "local" })).error;
  } catch (error) {
    console.error("sign-out failed:", error.message);
  }
  if (!signedOut) return NextResponse.json({ error: "Could not sign out. Try again.", signedOut: false }, { status: 503 });
  if (!revoked) return NextResponse.json({ error: "Signed out, but the LinkedIn extension could not be unpaired. Remove it from the browser.", signedOut: true }, { status: 503 });
  return NextResponse.json({ ok: true, signedOut: true });
}
