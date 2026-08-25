// Personalized avatar video pipeline: HeyGen (talking photo) + ElevenLabs (voice clone).
// All functions throw on failure. Callers degrade to script-only pitches.
import { guessCompanyDomain } from "@/lib/domain";

const HEYGEN = process.env.HEYGEN_API_KEY;
const ELEVEN = process.env.ELEVENLABS_API_KEY;

export const videoEnabled = () => !!HEYGEN;

// ---- HeyGen: create a talking-photo avatar from the user's face photo ----
export async function uploadTalkingPhoto(buffer, mime = "image/jpeg") {
  const r = await fetch("https://upload.heygen.com/v1/talking_photo", {
    method: "POST",
    headers: { "x-api-key": HEYGEN, "Content-Type": mime },
    body: buffer,
  });
  const d = await r.json();
  const id = d?.data?.talking_photo_id;
  if (!r.ok || !id) throw new Error(`HeyGen photo upload failed: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return id;
}

// ---- HeyGen: instant voice clone from the user's voice sample ----
// Single-vendor path (no ElevenLabs needed). Returns a voice_clone_id usable
// directly as voice_id in v2 video generation. Ready in minutes; poll-free here
// since the user hunts well after onboarding.
// HeyGen validates the declared media_type against what it detects in the bytes,
// and it labels WAV as "audio/x-wav" (not "audio/wav"), mp3 as "audio/mpeg", etc.
// Sniff the actual container from magic bytes so the declared type always matches.
function sniffAudioType(buf, fallback = "audio/mpeg") {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") return "audio/x-wav";
  if (buf.length > 3 && buf.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (buf.length > 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg"; // mp3 frame sync
  if (buf.length > 8 && buf.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";       // m4a/mp4
  if (buf.length > 4 && buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (fallback === "audio/wav") return "audio/x-wav";
  return fallback;
}

export async function cloneVoiceHeyGen(buffer, mime = "audio/mpeg", name = "gigaprowl-voice") {
  const mediaType = sniffAudioType(buffer, mime);
  const r = await fetch("https://api.heygen.com/v3/voices/clone", {
    method: "POST",
    headers: { "x-api-key": HEYGEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: { type: "base64", media_type: mediaType, data: buffer.toString("base64") },
      voice_name: name,
      remove_background_noise: true,
    }),
  });
  const d = await r.json().catch(() => ({}));
  const id = d?.data?.voice_clone_id;
  if (!r.ok || !id) throw new Error(`HeyGen voice clone failed: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return id;
}

// ---- ElevenLabs: instant voice clone from the user's voice sample (legacy) ----
export async function cloneVoice(buffer, filename, name, mime = "audio/mpeg") {
  const form = new FormData();
  form.append("name", name);
  // The Blob MUST carry an audio content-type or ElevenLabs rejects the upload.
  form.append("files", new Blob([buffer], { type: mime }), filename);
  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": ELEVEN },
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.voice_id) {
    if (r.status === 401 && /permission|create_instant_voice_clone|missing_permis/i.test(JSON.stringify(d)))
      throw new Error("Your ElevenLabs API key can't create voice clones yet. In ElevenLabs → API Keys, enable the 'Voices' write permission (create_instant_voice_clone) on this key, and make sure your plan includes Instant Voice Cloning (the free tier doesn't). Then re-upload your voice sample.");
    throw new Error(`ElevenLabs clone failed: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  }
  return d.voice_id;
}

// ---- ElevenLabs: TTS the pitch script in the user's cloned voice ----
async function ttsAudio(script, voiceId) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN, "Content-Type": "application/json" },
    body: JSON.stringify({ text: script.slice(0, 2500), model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) throw new Error(`ElevenLabs TTS failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---- HeyGen: upload audio asset ----
async function uploadAudioAsset(buffer) {
  const r = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: { "x-api-key": HEYGEN, "Content-Type": "audio/mpeg" },
    body: buffer,
  });
  const d = await r.json();
  const id = d?.data?.id;
  if (!r.ok || !id) throw new Error(`HeyGen audio upload failed: ${r.status}`);
  return id;
}

// Public default HeyGen voice (used when the user skipped the voice sample).
const DEFAULT_HEYGEN_VOICE = "1bd001e7e50f421d891986aad5158bc8";

// Circular talking-photo bubble, parked on the right like a Loom recording.
// NOTE: offset/scale likely need one tuning pass after the first real render.
// HeyGen's exact offset convention isn't fully documented.
function circleCharacter(talkingPhotoId) {
  return {
    type: "talking_photo",
    talking_photo_id: talkingPhotoId,
    talking_photo_style: "circle",
    scale: 0.42,
    offset: { x: 0.33, y: 0.22 }, // shift right + slightly down
  };
}

// Best-guess company domain (for the website-screenshot slide) from the name,
// unless an explicit website is passed in.
function domainFor(company, explicit) {
  if (explicit) return explicit.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return guessCompanyDomain(company);
}

// Register an image with HeyGen and get an asset id. HeyGen fits its OWN hosted
// assets to the frame reliably; arbitrary remote-URL backgrounds get mis-scaled.
async function uploadImageAsset(buffer, mime = "image/png") {
  const r = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: { "x-api-key": HEYGEN, "Content-Type": mime },
    body: buffer,
  });
  const d = await r.json();
  const id = d?.data?.id;
  if (!r.ok || !id) throw new Error(`HeyGen image upload failed: ${r.status} ${JSON.stringify(d).slice(0, 160)}`);
  return id;
}

// Verify bytes are a real image (screenshot services often return HTML error /
// "generating" pages that would otherwise render as a black frame).
function isImage(b) {
  if (!b || b.length < 12) return false;
  if (b[0] === 0x89 && b[1] === 0x50) return true; // PNG
  if (b[0] === 0xff && b[1] === 0xd8) return true; // JPEG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // GIF
  if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") return true; // WebP
  return false;
}

// Fetch an image (our slide route or a screenshot service) and turn it into a
// HeyGen image-background. Returns null on any failure so the caller decides the
// fallback. We never silently ship a black frame.
async function bgFromUrl(url, timeoutMs = 18000) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GigaprowlBot/1.0)" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isImage(buf)) throw new Error(`not an image (${res.headers.get("content-type") || "?"})`);
    const ct = res.headers.get("content-type");
    const id = await uploadImageAsset(buf, ct && ct.startsWith("image/") ? ct : "image/png");
    return { type: "image", image_asset_id: id };
  } catch (e) {
    console.warn("bgFromUrl failed:", url, e.message);
    return null;
  }
}

// Clean text before TTS so the voice never garbles: dashes → comma pauses,
// strip symbols HeyGen mispronounces, collapse whitespace, and truncate at a
// WORD boundary (a mid-word cut is what produces the unintelligible sound).
function sanitizeSpeech(text, max = 340) {
  let t = (text || "")
    .replace(/[‒-―−]/g, ", ")   // – — ― − → comma pause
    .replace(/[•|*_`~^<>{}\[\]#]/g, " ")         // symbols TTS chokes on
    .replace(/&[a-z]+;/gi, " ")                    // stray HTML entities
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > max) {
    t = t.slice(0, max);
    const sp = t.lastIndexOf(" ");
    if (sp > 40) t = t.slice(0, sp);
    t = t.replace(/[\s,;:.\-]+$/, "") + ".";
  }
  return t;
}

async function heygenGenerate(video_inputs) {
  const r = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "x-api-key": HEYGEN, "Content-Type": "application/json" },
    body: JSON.stringify({ video_inputs, dimension: { width: 1280, height: 720 } }),
  });
  const d = await r.json();
  const videoId = d?.data?.video_id;
  if (!r.ok || !videoId) throw new Error(`HeyGen generate failed: ${r.status} ${JSON.stringify(d).slice(0, 300)}`);
  return videoId;
}

// ---- Kick off a render. Returns video_id (poll separately; renders take minutes). ----
// With `deck` + `base`, builds a Loom-style multi-scene video (title slide →
// company website screenshot → value slide, circular avatar on the right).
// Otherwise falls back to a single talking-photo scene.
export async function renderPitchVideo({ talkingPhotoId, heygenVoiceId, elevenVoiceId, script, deck, base, company, domain, name, role, research, mockupImage }) {
  // ---- Loom-style deck ----
  if (deck && base) {
    const character = circleCharacter(talkingPhotoId);
    const enc = encodeURIComponent;
    const dom = domainFor(company, domain);
    const vid = (t) => ({ type: "text", input_text: sanitizeSpeech(t), voice_id: heygenVoiceId || DEFAULT_HEYGEN_VOICE });
    const titleUrl = `${base}/api/slide?kind=title&company=${enc(company || "")}&domain=${enc(dom || "")}&name=${enc(name || "")}&role=${enc(role || "")}`;
    // Microlink renders the real page and returns the screenshot image directly.
    const shotUrl = dom ? `https://api.microlink.io/?url=${enc("https://" + dom)}&screenshot=true&meta=false&embed=screenshot.url` : null;

    const scenes = [{ bg: titleUrl, say: deck.intro, kind: "slide" }];
    // Live-website screenshot scene is OFF by default: 3rd-party screenshot
    // services often return a blank/loading page (white frame) that still passes
    // as a valid image, producing "blank screens" in the render. Our own slides
    // are deterministic. Flip ENABLE_SITESHOT=1 to bring it back once a reliable
    // screenshot provider is wired.
    if (shotUrl && process.env.ENABLE_SITESHOT === "1") scenes.push({ bg: shotUrl, say: deck.company, kind: "shot" });
    // Fold the company line into a branded slide instead, so the point still lands.
    else if (deck.company) {
      const compUrl = `${base}/api/slide?kind=value&company=${enc(company || "")}&heading=${enc(`Why ${company || "your team"}`)}&bullets=${enc((deck.value?.bullets || []).slice(0, 2).join("|"))}`;
      scenes.push({ bg: compUrl, say: deck.company, kind: "slide" });
    }

    // Researched "what I'd do for you" scene (falls back to a generic value slide).
    if (research && (research.ideas || []).length) {
      const ideasParam = research.ideas.map((it) => it.title).join("|");
      const ideasUrl = `${base}/api/slide?kind=ideas&company=${enc(company || "")}&angle=${enc(research.angle || "")}&ideas=${enc(ideasParam)}`;
      scenes.push({ bg: ideasUrl, say: research.angle || `Here's how I'd help ${company} specifically.`, kind: "slide" });
    } else {
      const valueUrl = `${base}/api/slide?kind=value&company=${enc(company || "")}&heading=${enc(deck.value?.heading || "")}&bullets=${enc((deck.value?.bullets || []).join("|"))}`;
      scenes.push({ bg: valueUrl, say: deck.value?.say, kind: "slide" });
    }

    const usable = scenes.filter((s) => s.say);
    const bgs = await Promise.all(usable.map((s) => bgFromUrl(s.bg)));
    const video_inputs = [];
    usable.forEach((s, i) => {
      let bg = bgs[i];
      if (!bg) {
        if (s.kind === "shot") return; // screenshot failed → drop the scene, never a black frame
        throw new Error(`Required ${s.kind} background could not be rendered`);
      }
      video_inputs.push({ character, voice: vid(s.say), background: bg });
    });
    if (!video_inputs.length) throw new Error("No valid video scenes were produced");

    // Optional AI mockup scene. Upload the generated image as a HeyGen asset.
    if (mockupImage) {
      try {
        const id = await uploadImageAsset(mockupImage, "image/png");
        video_inputs.push({ character, voice: vid("I even mocked up one idea for you. Here's what it could look like."), background: { type: "image", image_asset_id: id } });
      } catch (e) { console.warn("mockup scene skipped:", e.message); }
    }
    return await heygenGenerate(video_inputs);
  }

  // ---- Single-scene fallback (no deck content available) ----
  const shortScript = sanitizeSpeech(script, 300);
  let voice;
  if (heygenVoiceId) {
    voice = { type: "text", input_text: shortScript, voice_id: heygenVoiceId };
  } else if (elevenVoiceId && ELEVEN) {
    const audio = await ttsAudio(shortScript, elevenVoiceId);
    const audioAssetId = await uploadAudioAsset(audio);
    voice = { type: "audio", audio_asset_id: audioAssetId };
  } else {
    console.warn("renderPitchVideo: no cloned voice, using DEFAULT_HEYGEN_VOICE (upload a voice sample to clone yours)");
    voice = { type: "text", input_text: shortScript, voice_id: DEFAULT_HEYGEN_VOICE };
  }
  return await heygenGenerate([{
    character: { type: "talking_photo", talking_photo_id: talkingPhotoId },
    voice,
    background: { type: "color", value: "#0A0E0D" },
  }]);
}

// ---- Poll render status ----
export async function getVideoStatus(videoId) {
  const r = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { "x-api-key": HEYGEN },
  });
  const d = await r.json();
  const s = d?.data;
  if (!r.ok || !s) throw new Error(`HeyGen status failed: ${r.status}`);
  return { status: s.status, videoUrl: s.video_url || null, error: s.error?.message || null };
}

// ---- HeyGen: list stock avatars / voices (to pick a UGC spokesperson) ----
export async function heygenList(kind) {
  const url = kind === "voices" ? "https://api.heygen.com/v2/voices" : "https://api.heygen.com/v2/avatars";
  const r = await fetch(url, { headers: { "x-api-key": HEYGEN } });
  const d = await r.json();
  if (!r.ok) throw new Error(`HeyGen ${kind} ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d.data;
}

// ---- HeyGen: spokesperson ad. A stock avatar reads a script over a brand
// background, with burned-in captions. Returns the video_id (poll separately).
export async function heygenSpokesperson({ avatarId, voiceId, script, bg = "#0A0E0D", width = 720, height = 1280, caption = true, speed = 1.05 }) {
  const video_inputs = [{
    character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
    voice: { type: "text", input_text: script, voice_id: voiceId, speed },
    background: { type: "color", value: bg },
  }];
  const r = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "x-api-key": HEYGEN, "Content-Type": "application/json" },
    body: JSON.stringify({ video_inputs, dimension: { width, height }, caption }),
  });
  const d = await r.json();
  const id = d?.data?.video_id;
  if (!r.ok || !id) throw new Error(`HeyGen generate ${r.status}: ${JSON.stringify(d).slice(0, 300)}`);
  return id;
}
