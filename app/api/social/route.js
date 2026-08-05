import { NextResponse } from "next/server";
import { getUserState, updateUserState, getPitch, uid } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateSocialPosts } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Deferred social-post generation — decoupled from the hunt so its 3 Claude
// calls (draft + 2 fact-checks) get their own 60s budget. Idempotent per match.
// POST { matchId }  → generates the LinkedIn post + X thread for that pitch.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { matchId } = await req.json();
    const state = await getUserState(userId);
    if (state.socialPosts?.some((x) => x.matchId === matchId))
      return NextResponse.json({ ok: true, already: true });

    const ref = (state.pitchRefs || []).find((p) => p.matchId === matchId);
    if (!ref) return NextResponse.json({ error: "No pitch for this match yet" }, { status: 404 });
    const pitch = await getPitch(ref.slug);
    if (!pitch) return NextResponse.json({ error: "Pitch not found" }, { status: 404 });

    const job = { title: ref.job?.title, company: ref.job?.company, description: pitch.job?.description || "" };
    const social = await generateSocialPosts(pitch.profileSnapshot || state.profile, job, pitch.content);
    if (!social || !social.linkedinPost) {
      await markStatus(userId, matchId, "failed");
      return NextResponse.json({ error: "Generation returned nothing" }, { status: 500 });
    }

    const socialUrl = `${ref.url}?ref=social`;
    await updateUserState(userId, (s) => {
      if (s.socialPosts.some((x) => x.matchId === matchId)) return;
      s.socialPosts.push({
        id: uid("post"), matchId, company: job.company, jobTitle: job.title,
        linkedinPost: (social.linkedinPost || "").replaceAll("{{pitch_url}}", socialUrl),
        twitterThread: (social.twitterThread || []).map((t) => String(t).replaceAll("{{pitch_url}}", socialUrl)),
        angle: social.postAngle || null,
        createdAt: new Date().toISOString(),
      });
      const r = s.pitchRefs.find((p) => p.matchId === matchId);
      if (r) r.socialStatus = "ready";
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function markStatus(userId, matchId, status) {
  await updateUserState(userId, (s) => {
    const r = s.pitchRefs.find((p) => p.matchId === matchId);
    if (r) r.socialStatus = status;
  });
}
