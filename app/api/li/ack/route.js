import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { updateUserState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-prowl-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

// POST { results: [{ id, ok, error }] }. The extension reports what it executed.
// We finalize the queue item, mark the matching cadence step sent, and log it.
export async function POST(req) {
  const userId = verifySessionToken(req.headers.get("x-prowl-token"));
  if (!userId) return NextResponse.json({ error: "Bad token" }, { status: 401, headers: CORS });

  const { results } = await req.json().catch(() => ({ results: [] }));
  if (!Array.isArray(results)) return NextResponse.json({ error: "results[] required" }, { status: 400, headers: CORS });

  const anyCheckpoint = results.some((r) => !r.ok && /checkpoint/i.test(r.error || ""));

  await updateUserState(userId, (s) => {
    for (const r of results) {
      const item = (s.linkedinQueue || []).find((a) => a.id === r.id);
      if (!item || item.status !== "pending") continue;
      item.status = r.ok ? "sent" : "failed";
      item.result = r.ok ? (r.did || "ok") : (r.error || "failed").slice(0, 200);
      item.at = new Date().toISOString();
      const cad = s.cadences.find((c) => c.id === item.cadenceId);
      if (cad && cad.steps[item.stepIndex]) {
        cad.steps[item.stepIndex].status = r.ok ? "sent" : "failed";
        if (r.ok) cad.steps[item.stepIndex].sentAt = new Date().toISOString();
      }
      // `did` reflects what actually happened after the live degree check.
      const invited = /invite/.test(r.did || (item.type === "invite" ? "invite" : "dm"));
      s.sends.push({ id: `send_${item.id}`, cadenceId: item.cadenceId, stepIndex: item.stepIndex, matchId: item.matchId, channel: invited ? "linkedin_invite" : "linkedin_dm", to: item.identifier, status: r.ok ? "sent" : "failed", at: new Date().toISOString() });
    }
    // Surface a session checkpoint so the dashboard can prompt a re-login.
    if (s.connections.linkedin) s.connections.linkedin.status = anyCheckpoint ? "checkpoint" : "ok";
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
