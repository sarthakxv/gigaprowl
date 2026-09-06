import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState } from "@/lib/db";
import { unipileEnabled, resolveProfile, sendInvitation, sendMessage, identifierFromUrl } from "@/lib/unipile";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { profileUrl, message, dm? }. End-to-end LinkedIn test via Unipile.
// Resolves the profile, then sends a connection request (or a DM if dm:true).
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (!unipileEnabled()) return NextResponse.json({ error: "LinkedIn connection isn't available right now" }, { status: 501 });

    const { profileUrl, message, dm } = await req.json();
    const state = await getUserState(userId);
    const accountId = state.connections?.linkedin?.accountId;
    if (!accountId) return NextResponse.json({ error: "Connect your LinkedIn first" }, { status: 400 });

    const identifier = identifierFromUrl(profileUrl) || (profileUrl || "").trim();
    if (!identifier) return NextResponse.json({ error: "Give a LinkedIn profile URL or public handle" }, { status: 400 });

    const providerId = await resolveProfile({ accountId, identifier });
    if (!providerId) return NextResponse.json({ error: "Couldn't resolve that profile" }, { status: 404 });

    const result = dm
      ? await sendMessage({ accountId, providerId, text: message || "Hi!" })
      : await sendInvitation({ accountId, providerId, message: (message || "").slice(0, 290) });

    return NextResponse.json({ ok: true, action: dm ? "message" : "invite", providerId, result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
