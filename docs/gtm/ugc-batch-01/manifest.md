# Gigaprowl — UGC Batch 01 (Seedance/Wan2.2-5B via HuggingFace + fal-ai)

**Engine:** HuggingFace Inference Providers → fal-ai → `Wan-AI/Wan2.2-TI2V-5B` (text-to-video)
**Cost:** ~$0.02–0.05 per clip · **Format:** vertical 9:16 · **Length:** ~5s each · **Delivered:** downloaded to your Downloads folder as `gigaprowl_ugc_0X_*.mp4`

These are **B-roll / visual clips** (no dialogue) — drop them under a captioned hook + voiceover in CapCut. Pair each with the matching hook from `docs/gtm/04-ugc-concepts.md`.

| File | Angle | Pair with this hook (on-screen text + VO) | Platform |
|---|---|---|---|
| `gigaprowl_ugc_01_rage_robot.mp4` | Job-market rage | "A robot rejected my resume in 0.3 seconds. It didn't even open the file." | TikTok / Reels |
| `gigaprowl_ugc_02_ghost_job.mp4` | Ghost jobs | "This job has been 'urgently hiring' since January. It is now July." | TikTok |
| `gigaprowl_ugc_03_the_void.mp4` | The void | "Week 1: 150 applications, 2 replies. Then I stopped applying." | Reels / TikTok |
| `gigaprowl_ugc_04_pitch_wow.mp4` | Product wow | "wait… it made a personal pitch page + video of me for every company?" | Reels / X |
| `gigaprowl_ugc_05_receipts_inbox.mp4` | Receipts / replies | "I sent ONE thing this week. The VP replied in four hours." | TikTok / LinkedIn |
| `gigaprowl_ugc_06_pov_hired.mp4` | POV got noticed | "POV: you stopped applying and started getting hunted." | Reels / TikTok |

**End card for all:** `gigaprowl. stop applying, start getting noticed. 5 free hunts → gigaprowl.vercel.app`

## How to reproduce / extend the batch
Run from the browser (no server needed) against:
`POST https://router.huggingface.co/fal-ai/fal-ai/wan/v2.2-5b/text-to-video`
Header: `Authorization: Bearer <HF_TOKEN>` · Body: `{"prompt":"<vertical 9:16 …>"}`
Returns JSON `{video:{url}}` in ~15–100s (cold starts vary). Fetch the url → mp4.

## Notes
- Wan2.2-5B is visual-only; for talking-head UGC use the HeyGen pipeline instead (`lib/video.js`).
- Render times ranged 14–103s (fal cold starts). Re-running warm is faster.
- Next batch ideas: POV-meme slideshows (Angle C), "Deb from HR" recurring character, split-screen portal-vs-Gigaprowl.
