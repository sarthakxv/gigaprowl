// Core hunt engine, shared by /api/outreach (one hunt) and /api/autopilot
// (tiered batch). A full hunt is contacts + pitch page + cadence, plus video
// when enabled, and costs 1 credit.
import { updateUserState, savePitch, uid } from "@/lib/db";
import { findContacts } from "@/lib/apollo";
import { generateCadence, generatePitch } from "@/lib/ai";
import { videoEnabled } from "@/lib/video";
import { videoEligibility } from "@/lib/match";
import { getHiringSignal, signalScoreBoost } from "@/lib/signals";
import { creditsAreUnlimited } from "@/lib/credits";
import { appUrl } from "@/lib/constants";

// Race a promise against a timeout; resolve to `fallback` if it's too slow.
// Keeps any single external call (Parallel signal lookup, extra Claude call)
// from pushing the whole hunt past Vercel's 60s function limit.
function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((res) => setTimeout(() => res(fallback), ms)),
  ]);
}

// Runs a full hunt for one job. Assumes caller already validated profile +
// credit balance. Throws on hard failures (e.g. no contacts found).
export async function runFullHunt({ userId, state, job, base }) {
  const matchId = job.sourceId;
  const unlimitedCredits = creditsAreUnlimited();

  // Contact discovery + hiring signal run concurrently (both network-heavy).
  // The signal is a personalization bonus. Hard-cap it at 8s and fall back
  // to the instant mock so a slow Parallel run can never time out the hunt.
  const [contacts, signal] = await Promise.all([
    findContacts(job),
    withTimeout(getHiringSignal(job.company), 8000, null),
  ]);
  const primary = contacts[0];
  if (!primary) throw new Error("No contacts found for this company");

  const [pitch, cadence] = await Promise.all([
    generatePitch(state.profile, job, signal),
    generateCadence(state.profile, job, primary, signal, state.settings?.emailStyle || "standard"),
  ]);

  // Social posts are DECOUPLED (like the video pipeline): generating them here
  // means 2 extra Claude calls (draft + unslop) that would blow the hunt's
  // 60s budget. The dashboard fires /api/social per pitch to fill them in after.
  const slug = `${state.profile.name.split(" ")[0]}-${job.company}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
  const pitchUrl = `${base}/p/${slug}`;

  // Save the pitch page FIRST so it's live immediately. The heavy video
  // pipeline is decoupled: "pending" and the pitch page triggers /api/video/build.
  const eligibility = videoEligibility(state.profile, job);
  const willRenderVideo = videoEnabled() && !!state.media.talkingPhotoId && eligibility.eligible;
  const videoStatus = willRenderVideo ? "pending" : "script_ready";
  await savePitch(slug, {
    id: uid("pitch"), slug, userId, url: pitchUrl,
    job: {
      title: job.title,
      company: job.company,
      companyDomain: job.companyDomain || null,
      url: job.url,
      description: (job.description || "").slice(0, 600),
    },
    content: pitch,
    profileSnapshot: state.profile,
    signal: signal || null,
    videoEligibility: { eligible: eligibility.eligible, reasons: eligibility.reasons },
    videoStatus,
    videoId: null, videoUrl: null,
    createdAt: new Date().toISOString(),
  });

  return updateUserState(userId, (s) => {
    s.contacts.push(...contacts.filter((c) => !s.contacts.some((x) => x.id === c.id)).map((c) => ({ ...c, matchId })));
    s.pitchRefs.push({
      slug, url: pitchUrl, matchId,
      headline: pitch.headline,
      job: { title: job.title, company: job.company },
      signal: signal ? { hiring: signal.hiring, openRoles: signal.openRoles, event: signal.event } : null,
      videoStatus,
      socialStatus: "pending", // dashboard triggers /api/social to fill this in
      createdAt: new Date().toISOString(),
    });
    s.cadences.push({
      id: uid("cad"), matchId, contactId: primary.id, contactName: primary.name, contactTitle: primary.title,
      company: job.company, jobTitle: job.title,
      signalBoost: signalScoreBoost(signal),
      // Per-step tracking params so pitch-page opens can be attributed (?ref=email&d=2).
      steps: cadence.steps.map((st) => {
        const tracked = `${pitchUrl}?ref=${encodeURIComponent(st.channel || "outreach")}&d=${st.day}`;
        return { ...st, body: st.body.replaceAll("{{pitch_url}}", tracked), status: "draft" };
      }),
      status: "draft", createdAt: new Date().toISOString(),
    });
    s.statusById[matchId] = "outreach_ready";
    if (!unlimitedCredits) {
      s.credits.balance -= 1;
      s.credits.used += 1;
    }
    return { pitchUrl, contacts: contacts.length, cadenceSteps: cadence.steps.length, creditsLeft: s.credits.balance, unlimitedCredits };
  });
}

export function requestBase(req) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return host ? `${proto}://${host}` : appUrl();
}
