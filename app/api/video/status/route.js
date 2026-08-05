import { NextResponse } from "next/server";
import { getPitch, savePitch } from "@/lib/db";
import { getVideoStatus } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public by slug (pitch pages are public). Polls HeyGen once and caches the result.
export async function GET(req) {
  try {
    const slug = new URL(req.url).searchParams.get("slug");
    const pitch = slug && (await getPitch(slug));
    if (!pitch) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (pitch.videoStatus === "ready" || pitch.videoStatus === "failed" || !pitch.videoId)
      return NextResponse.json({ status: pitch.videoStatus, videoUrl: pitch.videoUrl || null });

    const s = await getVideoStatus(pitch.videoId);
    if (s.status === "completed" && s.videoUrl) {
      pitch.videoStatus = "ready";
      pitch.videoUrl = s.videoUrl;
      await savePitch(slug, pitch);
    } else if (s.status === "failed") {
      pitch.videoStatus = "failed";
      pitch.videoError = s.error;
      await savePitch(slug, pitch);
    }
    return NextResponse.json({ status: pitch.videoStatus, videoUrl: pitch.videoUrl || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
