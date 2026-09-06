// UGC video generation via Hugging Face Inference Providers (cheap open models).
// HF routes text-to-video to a provider (fal-ai / replicate / novita) running an
// open model. Far cheaper than a fixed per-clip vendor. Returns raw video bytes.
//
// Env:
//   HF_TOKEN: HF access token with "Inference Providers" permission
//   HF_VIDEO_MODEL: default "Lightricks/LTX-Video-0.9.8-13B-distilled" (fast/cheap)
//   HF_PROVIDER: default "fal-ai"
//   HF_VIDEO_URL: optional full override for the router endpoint (set after probing)

const TOKEN = process.env.HF_TOKEN;
const MODEL = process.env.HF_VIDEO_MODEL || "Lightricks/LTX-Video-0.9.8-13B-distilled";
const PROVIDER = process.env.HF_PROVIDER || "fal-ai";

export const ugcEnabled = () => !!TOKEN;
export const ugcModel = () => MODEL;

function endpoint() {
  if (process.env.HF_VIDEO_URL) return process.env.HF_VIDEO_URL;
  // HF Inference Providers router. Task-based models route through the provider
  // path; confirmed/corrected via a live probe before the first real batch.
  return `https://router.huggingface.co/${PROVIDER}/models/${MODEL}`;
}

// Generate one short clip. Returns { mime, base64 }. Small marketing shorts fit
// comfortably in a JSON response and can be written straight to disk.
// opts: { numFrames=96, guidanceScale=3.5, negativePrompt, steps }
export async function generateUgcClip(prompt, opts = {}) {
  if (!TOKEN) throw new Error("HF_TOKEN not set");
  const parameters = {
    num_frames: opts.numFrames || 96,
    guidance_scale: opts.guidanceScale ?? 3.5,
  };
  if (opts.negativePrompt) parameters.negative_prompt = [opts.negativePrompt];
  if (opts.steps) parameters.num_inference_steps = opts.steps;

  const r = await fetch(endpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt, parameters }),
  });

  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HF video failed: ${r.status} ${txt.slice(0, 240)}`);
  }
  // Some providers return JSON with a hosted URL instead of raw bytes.
  if (ct.includes("application/json")) {
    const d = await r.json().catch(() => ({}));
    const url = d?.video?.url || d?.output?.[0] || d?.url || d?.video_url;
    if (url) return { mime: "video/mp4", url };
    throw new Error(`HF video: unexpected JSON ${JSON.stringify(d).slice(0, 200)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1000) throw new Error(`HF video: tiny/empty response (${buf.length}b)`);
  return { mime: ct.startsWith("video/") ? ct : "video/mp4", base64: buf.toString("base64") };
}
