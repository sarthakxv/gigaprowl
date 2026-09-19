import { NextResponse } from "next/server";
import { getUserId, createSessionToken } from "@/lib/auth";
import { requestBase } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → a pairing token the user pastes into the browser extension. It's a
// signed session token; the extension sends it back on every pull/ack so we
// know which user's queue to serve. No cookies needed cross-origin.
export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ token: createSessionToken(userId), base: requestBase(req) });
}
