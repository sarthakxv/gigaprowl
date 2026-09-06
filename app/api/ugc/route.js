import { NextResponse } from "next/server";
import { generateUgcClip, ugcEnabled, ugcModel } from "@/lib/ugc";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Guarded marketing tool. NOT user-facing. Generates one Hugging Face
// text-to-video UGC clip per call. Protected by x-ugc-token so randoms can't
// burn credits. We generate one-per-request (not a batch loop) so each render
// stays inside the 60s function limit; the caller loops over concepts.
function authed(req) {
  const token = process.env.UGC_ADMIN_TOKEN || process.env.CRON_SECRET || process.env.SESSION_SECRET;
  return token && req.headers.get("x-ugc-token") === token;
}

// POST { prompt, numFrames?, negativePrompt?, steps? }
// → { model, mime, base64 }  (or { model, url } if the provider hosts it)
export async function POST(req) {
  if (!authed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!ugcEnabled()) return NextResponse.json({ error: "HF_TOKEN not set" }, { status: 501 });
  try {
    const body = await req.json();
    if (!body?.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
    const clip = await generateUgcClip(body.prompt, {
      numFrames: body.numFrames,
      negativePrompt: body.negativePrompt,
      steps: body.steps,
    });
    return NextResponse.json({ model: ugcModel(), ...clip });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: quick config check (does not generate).
export async function GET(req) {
  if (!authed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ enabled: ugcEnabled(), model: ugcModel() });
}
