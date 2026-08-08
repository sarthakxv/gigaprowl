# Gigaprowl — Final Ad: "stop applying, start getting hunted"

**Format:** 9:16 vertical (~720×1280), 24fps, ~30s VO + matching B-roll.
**CTA (live product):** 5 free hunts · Free / Plus $19 / Max $49 — `prowl-livid.vercel.app`
**Script source:** `ad_script_stop-applying.txt` (captions + VO beats).
**Pipeline (current):** fal.ai Wan 2.2-5B text-to-video (5 clips) → ElevenLabs VO ("Liam") → `fal-ai/ffmpeg-api/compose` (auto-stitch). Alternate: Hugging Face Inference Providers → fal (`HF_TOKEN` / `lib/ugc.js`).

## Deliverable status

fal.media CDN links from the original render **expire** and should be treated as **gone**. Do not rely on old `v3b.fal.media/...` URLs.

| Asset | Where it lives |
|---|---|
| Final vertical MP4 | Re-render with the steps below; keep a local copy (e.g. Downloads / ads vault). |
| Scene clips | Same — regenerate; optional local names `scene1_void.mp4` … `scene5_hunted.mp4`. |
| Voiceover | ElevenLabs "Liam" → e.g. `gigaprowl_ad_voiceover.mp3` |

> After every successful compose, **download immediately** and re-host (Drive, R2, Vercel Blob, etc.). fal CDN is not archival storage.

## Timeline (target cut)

Align video beats to the VO in `ad_script_stop-applying.txt`:

| # | Scene | Window | VO beat |
|---|-------|--------|---------|
| 1 | scene1_void | 0:00–0:06 | "apply harder… 500 applications… wait in the void" |
| 2 | scene2_rejected | 0:06–0:11 | "the market is cooked, grinding isn't the flex" |
| 3 | scene3_upload | 0:11–0:18 | "flip it — upload once, let Gigaprowl hunt for you" |
| 4 | scene4_replies | 0:18–0:24 | "finds who's hiring, reaches the decision-maker, pitches you" |
| 5 | scene5_hunted | 0:24–0:30 | "stop applying, start getting hunted. Gigaprowl — five free hunts" |

**Known tweak:** if you stitch full ~6.7s Wan clips end-to-end (~33.5s) against a 30s VO, you get a silent tail. Trim the compose to **30s** or drop a branded end-card over the last ~3.5s.

**End card:** `gigaprowl. the smartest job hunter in the world. · 5 free hunts · prowl-livid.vercel.app`

## Reproduce / make new ads (no CapCut required)

1. **Clips** — `POST https://queue.fal.run/fal-ai/wan/v2.2-5b/text-to-video` with `{prompt, aspect_ratio:"9:16", resolution:"720p", num_frames:161}` (Header `Authorization: Key $FAL_KEY`). Poll `…/requests/{id}/status`, then `…/requests/{id}` → `video.url`. Download each clip immediately.
2. **VO** — ElevenLabs → MP3/WAV; for fal compose you can pass a base64 data-URI.
3. **Compose** — `POST https://queue.fal.run/fal-ai/ffmpeg-api/compose` with one `video` track (sequential clip keyframes) + one `audio` track (VO). Poll → `video_url` → **download**.
4. **Verify** — `fal-ai/ffmpeg-api/metadata` (free): duration, resolution, audio.

For CapCut polish instead, use the scene windows + captions in `ad_script_stop-applying.txt`. Pair related B-roll ideas with hooks in `docs/gtm/04-ugc-concepts.md` and the clip table in `manifest.md`.
