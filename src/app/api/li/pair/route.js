import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { issueExtensionToken } from "@/lib/extension-auth";
import { rateLimit } from "@/lib/db";
import { requestBase } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → a pairing token the user pastes into the browser extension. It's a
// signed session token; the extension sends it back on every pull/ack so we
// know which user's queue to serve. No cookies needed cross-origin.
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { allowed } = await rateLimit("extension-pair", userId, 5, 3600);
  if (!allowed) return NextResponse.json({ error: "Too many pairing requests" }, { status: 429 });
  return NextResponse.json({ token: await issueExtensionToken(userId), base: requestBase(req) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
