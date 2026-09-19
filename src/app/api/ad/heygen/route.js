import { NextResponse } from "next/server";
import { heygenList, heygenSpokesperson, getVideoStatus } from "@/lib/video";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Marketing-only HeyGen spokesperson generator. Guarded by a shared token so it
// isn't publicly callable. action=avatars|voices|status (GET) or generate (POST).
function authed(req) {
  const t = req.headers.get("x-ugc-token");
  return t && [process.env.SESSION_SECRET, process.env.CRON_SECRET, process.env.UGC_ADMIN_TOKEN].filter(Boolean).includes(t);
}

export async function GET(req) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.HEYGEN_API_KEY) return NextResponse.json({ error: "HEYGEN_API_KEY not set in this environment" }, { status: 501 });
  const u = new URL(req.url);
  const action = u.searchParams.get("action");
  try {
    if (action === "avatars") return NextResponse.json({ data: await heygenList("avatars") });
    if (action === "voices") return NextResponse.json({ data: await heygenList("voices") });
    if (action === "status") return NextResponse.json(await getVideoStatus(u.searchParams.get("id")));
    return NextResponse.json({ error: "action must be avatars|voices|status" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.HEYGEN_API_KEY) return NextResponse.json({ error: "HEYGEN_API_KEY not set in this environment" }, { status: 501 });
  try {
    const { script, avatarId, voiceId, width, height } = await req.json();
    if (!script || !avatarId || !voiceId) return NextResponse.json({ error: "script, avatarId, voiceId required" }, { status: 400 });
    const videoId = await heygenSpokesperson({ script, avatarId, voiceId, width, height });
    return NextResponse.json({ videoId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
