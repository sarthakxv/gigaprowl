import { NextResponse } from "next/server";
import { getAllUserIds, getUserState } from "@/lib/db";
import { dispatchStep, isLinkedIn } from "@/lib/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron hits GET daily. Releases any cadence step whose scheduled day has
// arrived and hasn't been actioned yet. Email goes to draft/send per the user's
// mode, LinkedIn queues for their extension. CRON_SECRET-gated.
const DAY = 86400000;
const PER_USER_CAP = 30;   // max steps released per user per run (safety)
const EMAIL_CAP = 40;      // max emails per user per run
const TIME_BUDGET_MS = 50000;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}
export async function POST(req) { return GET(req); } // manual trigger (also secret-gated)

async function run() {
  const started = Date.now();
  const userIds = await getAllUserIds();
  let released = 0, emails = 0, linkedin = 0, users = 0, errors = 0;

  for (const userId of userIds) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    let state;
    try { state = await getUserState(userId); } catch { continue; }
    if (!state.cadences?.length) continue;
    users++;
    let perUser = 0, perUserEmail = 0;

    for (const cad of state.cadences) {
      if (perUser >= PER_USER_CAP || Date.now() - started > TIME_BUDGET_MS) break;
      const daysSince = Math.floor((Date.now() - new Date(cad.createdAt).getTime()) / DAY);
      for (let i = 0; i < cad.steps.length; i++) {
        const step = cad.steps[i];
        if (["sent", "drafted", "queued"].includes(step.status)) continue;
        if ((step.day || 0) > daysSince) continue; // not due yet
        const email = !isLinkedIn(step.channel);
        if (email && perUserEmail >= EMAIL_CAP) continue;
        try {
          const r = await dispatchStep(userId, cad.id, i); // uses user's mode
          if (r.skipped) continue;
          released++; perUser++;
          if (r.queued) linkedin++; else { emails++; perUserEmail++; }
        } catch (e) {
          errors++; // e.g. Gmail not connected. Skip this step, keep going
        }
        if (perUser >= PER_USER_CAP) break;
      }
    }
  }

  return NextResponse.json({
    ok: true, usersScanned: users, released, emails, linkedin, errors,
    ms: Date.now() - started, truncated: Date.now() - started > TIME_BUDGET_MS,
  });
}
