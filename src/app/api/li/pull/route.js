import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { getUserState, updateUserState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS so the extension (chrome-extension:// origin) can call us.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-prowl-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

function tokenUser(req) {
  return verifySessionToken(req.headers.get("x-prowl-token"));
}

// GET → pending LinkedIn actions for this user, plus a per-day cap so the
// extension paces itself. Marks the extension as connected (lastSeen).
export async function GET(req) {
  const userId = tokenUser(req);
  if (!userId) return NextResponse.json({ error: "Bad token" }, { status: 401, headers: CORS });

  const state = await getUserState(userId);
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = (state.sends || []).filter((s) => /linkedin|invite|dm/i.test(s.channel || "") && s.status === "sent" && (s.at || "").slice(0, 10) === today).length;
  const DAILY_CAP = 20; // keep invites human-paced to protect the account
  const remaining = Math.max(0, DAILY_CAP - sentToday);

  const pending = (state.linkedinQueue || []).filter((a) => a.status === "pending").slice(0, remaining);

  await updateUserState(userId, (s) => {
    // Don't clobber a Unipile (server-side) connection with the extension state.
    // Unipile is the primary path. Only record extension liveness separately.
    if (s.connections.linkedin?.accountId) {
      s.connections.linkedinExt = { method: "extension", lastSeen: new Date().toISOString(), pairedAt: s.connections.linkedinExt?.pairedAt || new Date().toISOString() };
    } else {
      s.connections.linkedin = { ...(s.connections.linkedin || {}), method: "extension", lastSeen: new Date().toISOString(), pairedAt: s.connections.linkedin?.pairedAt || new Date().toISOString() };
    }
  });

  return NextResponse.json({ actions: pending, remainingToday: remaining }, { headers: CORS });
}
