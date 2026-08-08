import { NextResponse } from "next/server";
import { getUserState, updateUserState } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { uploadTalkingPhoto, cloneVoiceHeyGen } from "@/lib/video";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Consented capture of the user's OWN face photo + voice sample.
// Face → HeyGen talking-photo avatar. Voice → ElevenLabs instant clone.
// These power the personalized pitch videos the user reviews before sending.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const form = await req.formData();
    const kind = form.get("kind"); // "face" | "voice"
    const file = form.get("file");
    if (!file || !["face", "voice"].includes(kind))
      return NextResponse.json({ error: "kind must be face|voice with a file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    if (kind === "face") {
      if (!process.env.HEYGEN_API_KEY)
        return NextResponse.json({ error: "Avatar videos aren't configured yet (HEYGEN_API_KEY missing)" }, { status: 501 });
      // The avatar is created ONCE per profile and reused for every pitch video —
      // only the script/voice changes. Skip re-creating it unless the user is
      // explicitly replacing their photo (?replace=1), to avoid re-billing.
      const replace = new URL(req.url).searchParams.get("replace") === "1";
      const existing = (await getUserState(userId)).media?.talkingPhotoId;
      if (existing && !replace)
        return NextResponse.json({ ok: true, kind, avatar: true, reused: true });
      const mime = file.type || "image/jpeg";
      const talkingPhotoId = await uploadTalkingPhoto(buffer, mime);
      await updateUserState(userId, (s) => {
        s.media.facePhoto = true;
        s.media.talkingPhotoId = talkingPhotoId;
      });
      return NextResponse.json({ ok: true, kind, avatar: true });
    }

    // voice → HeyGen instant voice clone (single-vendor; same HEYGEN_API_KEY as the avatar)
    if (!process.env.HEYGEN_API_KEY)
      return NextResponse.json({ error: "Voice cloning isn't configured yet (HEYGEN_API_KEY missing)" }, { status: 501 });
    // The voice clone is created ONCE per profile and reused for every pitch —
    // only the script changes. Skip re-cloning (which burns clone quota) unless
    // the user is explicitly replacing their sample (?replace=1).
    const replaceVoice = new URL(req.url).searchParams.get("replace") === "1";
    const existingVoice = (await getUserState(userId)).media?.heygenVoiceId;
    if (existingVoice && !replaceVoice)
      return NextResponse.json({ ok: true, kind, voice: true, reused: true });
    const voiceMime = file.type || "audio/mpeg";
    const heygenVoiceId = await cloneVoiceHeyGen(buffer, voiceMime, `gigaprowl-${userId.slice(-6)}`);
    await updateUserState(userId, (s) => {
      s.media.voiceSample = true;
      s.media.heygenVoiceId = heygenVoiceId;
    });
    return NextResponse.json({ ok: true, kind, voice: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
