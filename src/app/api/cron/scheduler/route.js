import { NextResponse } from "next/server";
import { getUserState } from "@/lib/db";
import { dueCadenceSteps } from "@/lib/durable";
import { dispatchStep, isLinkedIn } from "@/lib/dispatch";
import { publicGmailConnection } from "@/lib/gmail";
import { cronUnauthorized } from "@/lib/cron-auth";
import { SCHEDULER_PER_USER_CAP, SCHEDULER_EMAIL_CAP, SCHEDULER_TIME_BUDGET_MS, SCHEDULER_FAILURE_CAP } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron hits GET daily. Releases any cadence step whose scheduled day has
// arrived and hasn't been actioned yet. Email goes to draft/send per the user's
// stored mode; LinkedIn queues for their extension.
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
  const due = await dueCadenceSteps();
  let released = 0, emails = 0, linkedin = 0, users = 0, errors = 0;
  const failures = [];
  const stateByUser = new Map();
  const counts = new Map();

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

  for (const item of due) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const userId = item.user_id;
    let state = stateByUser.get(userId);
    if (!state) {
      try { state = await getUserState(userId); } catch { continue; }
      stateByUser.set(userId, state);
      counts.set(userId, { total: 0, email: 0 });
      users++;
    }
    const count = counts.get(userId);
    if (count.total >= PER_USER_CAP) continue;
    const gmail = publicGmailConnection(state.connections?.gmail);
    const cad = state.cadences.find((candidate) => candidate.id === item.cadence_id);
    const step = cad?.steps?.[item.step_index];
    if (!step) continue;
    const email = !isLinkedIn(step.channel);
    if (!email && state.settings?.outreachMode !== "automated") continue;
    if (email && count.email >= EMAIL_CAP) continue;
    if (email && gmail?.reconnectRequired) {
      recordFailure(userId, cad.id, item.step_index, { code: "reauth_required", message: "Reconnect Gmail" });
      continue;
    }
    try {
      const result = await dispatchStep(userId, cad.id, item.step_index);
      if (result.skipped) continue;
      released++;
      count.total++;
      if (result.queued) linkedin++; else { emails++; count.email++; }
    } catch (error) {
      recordFailure(userId, cad.id, item.step_index, error);
    }
  }

  return NextResponse.json({
    ok: true, usersScanned: users, released, emails, linkedin, errors, failures,
    ms: Date.now() - started, truncated: due.length === 500 || Date.now() - started > TIME_BUDGET_MS,
  });
}
