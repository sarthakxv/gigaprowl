# Gigaprowl — Final Ad: "stop applying, start getting hunted"

**Format:** 9:16 vertical (704×1280), 24fps, ~33.5s video / 30s voiceover, with audio.
**Pipeline:** fal.ai — Wan 2.2-5B (5 clips, `aspect_ratio:9:16`, `num_frames:161`) → ElevenLabs VO ("Liam") → `fal-ai/ffmpeg-api/compose` (single auto-stitch, no CapCut).

## Final MP4
- **Vertical (deliverable):** https://v3b.fal.media/files/b/0aa257a1/6ODsxatM-Qx3ULLLc_Ntn_output.mp4
- Landscape 16:9 alt (earlier pass): https://v3b.fal.media/files/b/0aa2577e/G7B3l-FK9f3crE1PYHvaQ_output.mp4

> fal.media links are temporary CDN URLs — download and re-host / keep a local copy.

## Timeline (video track, back-to-back)
| # | Scene | In | VO beat |
|---|-------|----|---------|
| 1 | scene1_void | 0.0s | "apply harder… 500 applications… wait in the void" |
| 2 | scene2_rejected | 6.7s | "the market is cooked, grinding isn't the flex" |
| 3 | scene3_upload | 13.4s | "flip it — upload once, let Gigaprowl hunt for you" |
| 4 | scene4_replies | 20.1s | "finds who's hiring, reaches the decision-maker, pitches you" |
| 5 | scene5_hunted | 26.8s | "stop applying, start getting hunted. Gigaprowl — five free hunts" |

## Source clip URLs (vertical, 6.7s each)
- scene1_void: https://v3b.fal.media/files/b/0aa25794/nNrI5b72cJIz_XOvzzviB_txcaD3vX.mp4
- scene2_rejected: https://v3b.fal.media/files/b/0aa25794/8R5yCLrOg6_TDAE0qxL8n_Zh0tJFly.mp4
- scene3_upload: https://v3b.fal.media/files/b/0aa257a4/33kb0Yue9xrI4burhJsnC_aSqWQtHV.mp4
- scene4_replies: https://v3b.fal.media/files/b/0aa25798/WyQ4QT_AaTTxF007i37tP_ZXtxJKUP.mp4
- scene5_hunted: https://v3b.fal.media/files/b/0aa25798/zE2r0sferlkd6N-qZJQ9I_wyE6rxB4.mp4

## Known tweak
Compose plays each clip in full, so video (33.5s) runs ~3.5s past the 30s VO — a silent triumphant tail. To end exactly on the CTA, trim to 30s or drop a branded end-card over the last 3.5s.

## Reproduce / make new ads (fully automatic, no CapCut)
1. Generate N clips: `POST https://queue.fal.run/fal-ai/wan/v2.2-5b/text-to-video` with `{prompt, aspect_ratio:"9:16", resolution:"720p", num_frames:161}` (Header `Authorization: Key $FAL_KEY`). Poll `…/requests/{id}/status`, then `…/requests/{id}` → `video.url`.
2. Generate VO (ElevenLabs) → base64 data-URI (fal compose accepts data URIs).
3. `POST https://queue.fal.run/fal-ai/ffmpeg-api/compose` with tracks: one `video` track (keyframes = clip URLs, sequential `timestamp`/`duration` in ms) + one `audio` track (VO). Poll → `video_url`.
4. Verify with `fal-ai/ffmpeg-api/metadata` (free): duration, resolution, audio.
