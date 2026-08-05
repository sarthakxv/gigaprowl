import { NextResponse } from "next/server";
import { getPitch, savePitch, getUserState } from "@/lib/db";
import { renderPitchVideo, videoEnabled } from "@/lib/video";
import { getRoleResearch } from "@/lib/research";
import { generateMockupImage, mockupEnabled } from "@/lib/mockup";
import { videoEligibility } from "@/lib/match";

export const runtime = "nodejs";
export const maxDuration = 60; // Hobby cap — each stage below stays well under it.
export const dynamic = "force-dynamic";

// Stepped build state machine, driven call-by-call by the pitch page so no single
// request exceeds the serverless time limit:
//   stage "research" → deep company research (Parallel/Claude), stored on pitch
//   stage "render"   → Claude SVG mockup + multi-scene HeyGen render kickoff
// Each POST advances exactly one stage and returns {status, done}.
export async function POST(req) {
  try {
    const { slug } = await req.json();
    let pitch = slug && (await getPitch(slug));
    if (!pitch) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Terminal / already handed to HeyGen.
    if (pitch.videoId || pitch.videoStatus === "rendering" || pitch.videoStatus === "ready")
      return NextResponse.json({ status: pitch.videoStatus, done: true });
    if (!videoEnabled())
      return NextResponse.json({ status: "script_ready", done: true });

    const state = await getUserState(pitch.userId);
    if (!state.media?.talkingPhotoId)
      return NextResponse.json({ status: "script_ready", done: true });
    const eligibility = videoEligibility(pitch.profileSnapshot || state.profile, pitch.job);
    if (!eligibility.eligible) {
      pitch.videoStatus = "script_ready";
      pitch.videoEligibility = { eligible: false, reasons: eligibility.reasons };
      await savePitch(slug, pitch);
      return NextResponse.json({ status: "script_ready", done: true, reason: "Video skipped because this is not a strong enough fit" });
    }

    const stage = pitch.buildStage || "research";

    // ---- Stage 1: research ----
    if (stage === "research") {
      pitch.videoStatus = "building";
      try {
        const research = await getRoleResearch(pitch.profileSnapshot, pitch.job);
        pitch.research = research; // {discipline, angle, ideas, mockupBrief, source}
        pitch.buildStage = "render";
        await savePitch(slug, pitch);
        return NextResponse.json({ status: "building", stage: "render", done: false });
      } catch (e) {
        console.error("research stage failed:", e.message);
        // Skip straight to render without research (generic value slide).
        pitch.buildStage = "render";
        await savePitch(slug, pitch);
        return NextResponse.json({ status: "building", stage: "render", done: false });
      }
    }

    // ---- Stage 2: mockup + render kickoff ----
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const base = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
    try {
      const research = pitch.research || null;
      // Mockup scene is OFF for now — the AI SVG mockups weren't good enough.
      // Video ends on the researched "how I'd help" ideas instead. Flip
      // ENABLE_MOCKUP=1 to bring it back once a real image model is wired.
      const mockupImage = (process.env.ENABLE_MOCKUP === "1" && mockupEnabled() && (research?.mockupBrief || research?.ideas?.length))
        ? await generateMockupImage({ brief: research.mockupBrief, idea: research.ideas?.[0], discipline: research.discipline, company: pitch.job?.company })
        : null;

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
        research,
        mockupImage,
      });

      pitch = (await getPitch(slug)) || pitch;
      pitch.videoId = videoId;
      pitch.videoStatus = "rendering";
      pitch.videoUrl = null;
      pitch.buildStage = "done";
      pitch.hasMockup = !!mockupImage;
      if (research) pitch.research = { discipline: research.discipline, angle: research.angle, ideas: research.ideas, source: research.source };
      await savePitch(slug, pitch);
      return NextResponse.json({ status: "rendering", done: true });
    } catch (e) {
      console.error("render stage failed:", e.message);
      pitch = (await getPitch(slug)) || pitch;
      pitch.videoStatus = "script_ready";
      pitch.videoError = e.message;
      await savePitch(slug, pitch);
      return NextResponse.json({ status: "script_ready", done: true, error: e.message });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
