import { NextResponse } from "next/server";
import { getUserState, updateUserState, getJobPool, uid } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { rankJobs, videoEligibility } from "@/lib/match";
import { generateApplyKit } from "@/lib/ai";
import { runFullHunt, requestBase } from "@/lib/hunt";
import { creditsAreUnlimited } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const FULL_BAND = 75; // score >= 75 → full hunt (1 credit)
const LITE_BAND = 50; // 50–74 → lite apply kit (0 credits)
const MAX_FULL = 3;
const MAX_LITE = 4;

// POST → tiered autopilot over the user's ranked matches.
// Top band gets the full treatment (pitch page + contacts + cadence, 1 credit
// each, credit-gated); mid band gets a free "apply kit" (tailored bullets +
// apply note). Idempotent per match via statusById.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const [state, pool] = await Promise.all([getUserState(userId), getJobPool()]);
    if (!state.profile) return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });

    const ranked = rankJobs(state.profile, pool.jobs).filter((m) => !state.statusById[m.job.sourceId]);
    const fullTargets = ranked
      .filter((m) => m.score >= FULL_BAND && videoEligibility(state.profile, m.job).eligible)
      .slice(0, MAX_FULL);
    const liteTargets = ranked.filter((m) => m.score >= LITE_BAND && m.score < FULL_BAND).slice(0, MAX_LITE);

    const base = requestBase(req);
    const unlimitedCredits = creditsAreUnlimited();
    const results = { full: [], lite: [], creditsLeft: state.credits.balance };

    // Full hunts run sequentially (each is heavy + mutates state), gated on credits.
    let credits = state.credits.balance;
    for (const m of fullTargets) {
      if (!unlimitedCredits && credits <= 0) break;
      try {
        // Re-read state each hunt so pushes accumulate correctly.
        const fresh = await getUserState(userId);
        const r = await runFullHunt({ userId, state: fresh, job: m.job, base });
        credits = r.creditsLeft;
        results.full.push({ matchId: m.job.sourceId, company: m.job.company, score: m.score, ...r });
      } catch (e) {
        console.error("autopilot full hunt failed:", m.job.company, e.message);
      }
    }

    // Lite hunts: one cheap Claude call each, run concurrently. 0 credits.
    const kits = await Promise.all(
      liteTargets.map(async (m) => {
        try {
          const kit = await generateApplyKit(state.profile, m.job);
          return {
            id: uid("kit"), matchId: m.job.sourceId, score: m.score,
            job: { title: m.job.title, company: m.job.company, url: m.job.url, location: m.job.location || null },
            ...kit,
            createdAt: new Date().toISOString(),
          };
        } catch (e) {
          console.error("apply kit failed:", m.job.company, e.message);
          return null;
        }
      })
    );
    const goodKits = kits.filter(Boolean);
    if (goodKits.length) {
      await updateUserState(userId, (s) => {
        for (const k of goodKits) {
          if (!s.applyKits.some((x) => x.matchId === k.matchId)) s.applyKits.push(k);
          s.statusById[k.matchId] = "apply_kit_ready";
        }
      });
    }
    results.lite = goodKits.map((k) => ({ matchId: k.matchId, company: k.job.company, score: k.score }));
    results.creditsLeft = credits;

    return NextResponse.json(results);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
