// Higgsfield Cloud API — Seedance video generation for UGC marketing assets.
// Docs: cloud.higgsfield.ai. Bearer auth. POST /generations → poll GET /generations/{id}.
//
// Seedance = ByteDance's text/image-to-video model (cinematic, native audio in 2.0).
// We use it for b-roll / meme / "the void" style ad concepts. Talking-head UGC still
// goes through HeyGen (lib/video.js). Field access is defensive because Higgsfield's
// exact response shape varies by model/version — read several likely keys.

const KEY = process.env.HIGGSFIELD_API_KEY;
const BASE = process.env.HIGGSFIELD_BASE || "https://api.higgsfield.ai/v1";
const MODEL = process.env.HIGGSFIELD_MODEL || "seedance-2.0";

export const higgsfieldEnabled = () => !!KEY;

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v != null) return v;
  }
  return null;
}

// Kick off one text-to-video generation. Returns the generation id.
// opts: { imageUrl?, durationSec=8, aspectRatio="9:16", resolution="1080p" }
export async function startSeedanceVideo(prompt, opts = {}) {
  if (!KEY) throw new Error("HIGGSFIELD_API_KEY not set");
  const { imageUrl = null, durationSec = 8, aspectRatio = "9:16", resolution = "1080p" } = opts;

  const body = {
    model: MODEL,
    task: imageUrl ? "image-to-video" : "text-to-video",
    prompt,
    duration: durationSec,
    aspect_ratio: aspectRatio,
    resolution,
  };
  if (imageUrl) body.input_image = imageUrl;

  const r = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  const id = pick(d, "id", "generation_id", "data.id", "job_id");
  if (!r.ok || !id) throw new Error(`Higgsfield start failed: ${r.status} ${JSON.stringify(d).slice(0, 240)}`);
  return id;
}

// Poll one generation. Returns { status: "queued"|"processing"|"completed"|"failed", videoUrl, error }.
export async function getSeedanceStatus(id) {
  if (!KEY) throw new Error("HIGGSFIELD_API_KEY not set");
  const r = await fetch(`${BASE}/generations/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Higgsfield status failed: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  const raw = String(pick(d, "status", "data.status", "state") || "").toLowerCase();
  const status =
    /complete|success|succeeded|done/.test(raw) ? "completed" :
    /fail|error|cancel/.test(raw) ? "failed" :
    /process|running|generat/.test(raw) ? "processing" : "queued";
  const videoUrl = pick(d, "output.video_url", "output_url", "video_url", "result.url", "assets.0.url", "data.video_url", "output.url");
  const error = pick(d, "error", "error_message", "data.error");
  return { status, videoUrl: videoUrl || null, error: error || null, raw };
}
