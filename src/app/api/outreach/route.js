import { NextResponse } from "next/server";
import { getUserState, getJobPool } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { runFullHunt, requestBase } from "@/lib/hunt";
import { creditsAreUnlimited } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { matchId } → contacts + pitch page + cadence for one company. Costs 1 credit.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { matchId } = await req.json();
    const [state, pool] = await Promise.all([getUserState(userId), getJobPool()]);
    if (!state.profile) return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
    if (!creditsAreUnlimited() && state.credits.balance <= 0) return NextResponse.json({ error: "Out of credits. Upgrade your plan" }, { status: 402 });
    const job = pool.jobs.find((j) => j.sourceId === matchId);
    if (!job) return NextResponse.json({ error: "Job not found. Run a scan and retry" }, { status: 404 });

    const result = await runFullHunt({ userId, state, job, base: requestBase(req) });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    const status = e.message.includes("No contacts") ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
