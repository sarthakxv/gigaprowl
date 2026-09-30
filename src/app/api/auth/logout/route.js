import { NextResponse } from "next/server";
import { getUserId, serverAuth } from "@/lib/auth";
import { revokeExtensionTokens } from "@/lib/extension-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A database outage must not keep a user signed in. Sessions end regardless;
// a failed pairing revocation is reported so the client can retry.
export async function POST() {
  let revoked = true;
  try {
    const userId = await getUserId();
    if (userId) await revokeExtensionTokens(userId);
  } catch (error) {
    revoked = false;
    console.error("extension revocation failed:", error.message);
  }
  let signedOut = false;
  try {
    signedOut = !(await serverAuth().auth.signOut({ scope: "global" })).error;
  } catch (error) {
    console.error("sign-out failed:", error.message);
  }
  if (!signedOut) return NextResponse.json({ error: "Could not sign out" }, { status: 503 });
  if (!revoked) return NextResponse.json({ error: "Signed out, but the LinkedIn extension could not be unpaired" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
