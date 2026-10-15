import { NextResponse } from "next/server";
import { getUserState, getJobPool, rateLimit } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { rankJobs } from "@/lib/match";
import { generateApplyKit } from "@/lib/ai";
import { buildApplyKitRecord, hasApplyKit, persistApplyKits } from "@/lib/applyKit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const FULL_BAND = 75; // 75+ is hunted one job at a time via /api/outreach
const LITE_BAND = 50;
const MAX_LITE = 4;

// POST → free apply kits (tailored bullets + apply note) for matches scored
// 50–74 that don't have one yet. It never hunts: hunts cost a credit and are
// always started per job from /api/outreach.
export async function POST(req) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const { allowed } = await rateLimit("autopilot", userId, 2, 3600);
    if (!allowed) return NextResponse.json({ error: "Too many runs. Try again later." }, { status: 429 });

    const [state, pool] = await Promise.all([getUserState(userId), getJobPool()]);
    if (!state.profile) return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });

    const liteTargets = rankJobs(state.profile, pool.jobs)
      .filter((m) => m.score >= LITE_BAND && m.score < FULL_BAND && !hasApplyKit(state, m.job.sourceId))
      .slice(0, MAX_LITE);

    // One cheap Claude call each, run concurrently. 0 credits.
    const kits = await Promise.all(
      liteTargets.map(async (m) => {
        try {
          const kit = await generateApplyKit(state.profile, m.job);
          return buildApplyKitRecord({ kit, job: m.job, score: m.score });
        } catch (e) {
          console.error("apply kit failed:", m.job.company, e.message);
          return null;
        }
      })
    );
    const goodKits = kits.filter(Boolean);
    await persistApplyKits(userId, goodKits);

    return NextResponse.json({
      lite: goodKits.map((k) => ({ matchId: k.matchId, company: k.job.company, score: k.score })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
