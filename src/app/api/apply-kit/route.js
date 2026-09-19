import { NextResponse } from "next/server";
import { getUserState, getJobPool, getPitch } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateApplyKit } from "@/lib/ai";
import { scoreJob } from "@/lib/match";
import { buildApplyKitRecord, hasApplyKit, persistApplyKits } from "@/lib/applyKit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { matchId }. One free kit. Safe to call twice.
// Runs after a hunt, and from Matches for jobs scored 50-74.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { matchId } = await req.json();
    if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

    const [state, pool] = await Promise.all([getUserState(userId), getJobPool()]);
    if (!state.profile) return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
    if (hasApplyKit(state, matchId)) return NextResponse.json({ ok: true, already: true });

    const resolved = await resolveJob(matchId, pool, state);
    if (!resolved) return NextResponse.json({ error: "Job not found. Run a scan and retry." }, { status: 404 });

    const kit = await generateApplyKit(state.profile, resolved.job);
    const record = buildApplyKitRecord({ kit, job: resolved.job, score: resolved.score });
    await persistApplyKits(userId, [record]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function resolveJob(matchId, pool, state) {
  const fromPool = pool.jobs.find((j) => j.sourceId === matchId);
  if (fromPool) {
    return { job: fromPool, score: scoreJob(state.profile, fromPool).score };
  }
  const ref = (state.pitchRefs || []).find((p) => p.matchId === matchId);
  if (!ref) return null;
  const pitch = await getPitch(ref.slug);
  const job = {
    sourceId: matchId,
    title: ref.job?.title,
    company: ref.job?.company,
    url: pitch?.job?.url || "",
    location: null,
    description: pitch?.job?.description || "",
  };
  return { job, score: scoreJob(state.profile, job).score };
}
