import { NextResponse } from "next/server";
import { getPitch, savePitch, getUserState } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { renderPitchVideo, videoEnabled } from "@/lib/video";
import { videoEligibility } from "@/lib/match";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { slug } — re-kick a failed/missing render. Owner only. Free (no credit charge).
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { slug } = await req.json();
    const pitch = slug && (await getPitch(slug));
    if (!pitch || pitch.userId !== userId)
      return NextResponse.json({ error: "Pitch not found" }, { status: 404 });
    if (pitch.videoStatus === "ready")
      return NextResponse.json({ status: "ready", videoUrl: pitch.videoUrl });
    if (!videoEnabled())
      return NextResponse.json({ error: "Video rendering not configured" }, { status: 501 });

    const state = await getUserState(userId);
    if (!state.media.talkingPhotoId)
      return NextResponse.json({ error: "Upload a face photo in onboarding first" }, { status: 400 });
    const eligibility = videoEligibility(pitch.profileSnapshot || state.profile, pitch.job);
    if (!eligibility.eligible)
      return NextResponse.json({ error: `Video skipped: ${eligibility.reasons.join("; ")}` }, { status: 422 });

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const base = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");

    const videoId = await renderPitchVideo({
      talkingPhotoId: state.media.talkingPhotoId,
      heygenVoiceId: state.media.heygenVoiceId || null,
      elevenVoiceId: state.media.elevenVoiceId || null,
      script: pitch.content.videoScript,
      deck: pitch.content.deck || null,
      base,
      company: pitch.job?.company,
      domain: pitch.job?.companyDomain || null,
      name: pitch.profileSnapshot?.name,
      role: pitch.job?.title,
    });
    pitch.videoId = videoId;
    pitch.videoStatus = "rendering";
    pitch.videoUrl = null;
    pitch.videoError = null;
    await savePitch(slug, pitch);
    return NextResponse.json({ status: "rendering" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
