import { NextResponse } from "next/server";
import { getAllUserIds, getUserState } from "@/lib/db";
import { dispatchStep, isLinkedIn } from "@/lib/dispatch";
import { publicGmailConnection } from "@/lib/gmail";
import { cronUnauthorized } from "@/lib/cron-auth";
import { DAY_MS, SCHEDULER_PER_USER_CAP, SCHEDULER_EMAIL_CAP, SCHEDULER_TIME_BUDGET_MS, SCHEDULER_FAILURE_CAP } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron hits GET daily. Releases any cadence step whose scheduled day has
// arrived and hasn't been actioned yet. Email goes to draft/send per the user's
// stored mode; LinkedIn queues for their extension.
const DAY = DAY_MS;
const PER_USER_CAP = SCHEDULER_PER_USER_CAP;
const EMAIL_CAP = SCHEDULER_EMAIL_CAP;
const TIME_BUDGET_MS = SCHEDULER_TIME_BUDGET_MS;
const FAILURE_CAP = SCHEDULER_FAILURE_CAP;

export async function GET(req) {
  if (cronUnauthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}
export async function POST(req) { return GET(req); }

async function run() {
  const started = Date.now();
  const userIds = await getAllUserIds();
  let released = 0, emails = 0, linkedin = 0, users = 0, errors = 0;
  const failures = [];

  function recordFailure(userId, cadenceId, stepIndex, e) {
    errors++;
    if (failures.length >= FAILURE_CAP) return;
    failures.push({
      userId,
      cadenceId,
      stepIndex,
      code: e?.code || "error",
      message: String(e?.message || "failed").slice(0, 160),
    });
  }

  for (const userId of userIds) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    let state;
    try { state = await getUserState(userId); } catch { continue; }
    if (!state.cadences?.length) continue;
    users++;
    let perUser = 0, perUserEmail = 0;
    const gmail = publicGmailConnection(state.connections?.gmail);

    for (const cad of state.cadences) {
      if (perUser >= PER_USER_CAP || Date.now() - started > TIME_BUDGET_MS) break;
      const daysSince = Math.floor((Date.now() - new Date(cad.createdAt).getTime()) / DAY);
      for (let i = 0; i < cad.steps.length; i++) {
        const step = cad.steps[i];
        if (["sent", "drafted", "queued", "failed", "dispatching", "uncertain"].includes(step.status)) continue;
        if ((step.day || 0) > daysSince) continue;
        const email = !isLinkedIn(step.channel);
        if (email && perUserEmail >= EMAIL_CAP) continue;
        if (email && gmail?.reconnectRequired) {
          recordFailure(userId, cad.id, i, { code: "reauth_required", message: "Reconnect Gmail" });
          continue;
        }
        try {
          const r = await dispatchStep(userId, cad.id, i);
          if (r.skipped) continue;
          released++; perUser++;
          if (r.queued) linkedin++; else { emails++; perUserEmail++; }
        } catch (e) {
          recordFailure(userId, cad.id, i, e);
        }
        if (perUser >= PER_USER_CAP) break;
      }
    }
  }

  return NextResponse.json({
    ok: true, usersScanned: users, released, emails, linkedin, errors, failures,
    ms: Date.now() - started, truncated: Date.now() - started > TIME_BUDGET_MS,
  });
}
