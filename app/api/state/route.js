import { NextResponse } from "next/server";
import { getUserState, getJobPool, getUserById } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { rankJobs, scoreJob } from "@/lib/match";
import { creditsAreUnlimited } from "@/lib/credits";
import { publicGmailConnection, gmailEnabled } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { headers: { "Cache-Control": "no-store, must-revalidate" } };

export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401, ...noStore });

  const [state, pool, user] = await Promise.all([getUserState(userId), getJobPool(), getUserById(userId)]);
  const jobs = Array.isArray(pool?.jobs) ? pool.jobs : [];

  // Matches computed live from the shared job pool against this user's profile.
  // Ranking must never 500 the whole payload — that used to look like "no profile".
  let matches = [];
  try {
    if (state.profile) {
      matches = rankJobs(state.profile, jobs).slice(0, 100).map((m) => ({
        ...m,
        id: m.job.sourceId,
        status: state.statusById?.[m.job.sourceId] || "new",
      }));
    }
  } catch (e) {
    console.error("match ranking failed:", e.message);
  }

  return NextResponse.json({
    // Account email verification. `undefined` on legacy accounts → treat as verified.
    account: { email: user?.email || null, emailVerified: true },
    profile: state.profile,
    media: { facePhoto: !!state.media?.facePhoto, voiceSample: !!state.media?.voiceSample },
    matches,
    contacts: state.contacts,
    cadences: state.cadences,
    pitches: state.pitchRefs,
    applyKits: (state.applyKits || []).map((k) => {
      const live = matches.find((m) => m.id === k.matchId);
      if (typeof live?.score === "number") return { ...k, score: live.score };
      if (typeof k.score === "number") return k;
      if (!state.profile || !k.job) return k;
      try {
        return { ...k, score: scoreJob(state.profile, { title: k.job.title, company: k.job.company, description: "", tags: [] }).score };
      } catch {
        return k;
      }
    }),
    socialPosts: state.socialPosts || [],
    credits: { ...state.credits, unlimited: creditsAreUnlimited() },
    sends: state.sends || [],
    settings: { outreachMode: state.settings?.outreachMode || "manual", emailStyle: state.settings?.emailStyle || "standard" },
    liQueue: { pending: (state.linkedinQueue || []).filter((a) => a.status === "pending").length },
    // Connected channels. Expose status only, never the tokens.
    connections: {
      gmail: publicGmailConnection(state.connections?.gmail),
      linkedin: state.connections?.linkedin?.accountId
        ? { method: "managed", accountId: true, name: state.connections.linkedin.name || null, connectedAt: state.connections.linkedin.connectedAt || null }
        : state.connections?.linkedin?.pairedAt
        ? { method: "extension", pairedAt: state.connections.linkedin.pairedAt, lastSeen: state.connections.linkedin.lastSeen || null, status: state.connections.linkedin.status || "ok" }
        : null,
    },
    lastSync: pool?.lastSync || null,
    jobCount: jobs.length,
    integrations: {
      ai: !!process.env.ANTHROPIC_API_KEY,
      apollo: !!process.env.APOLLO_API_KEY,
      parallel: !!process.env.PARALLEL_API_KEY,
      adzuna: !!process.env.ADZUNA_APP_ID,
      smartlead: !!process.env.SMARTLEAD_API_KEY,
      heygen: !!process.env.HEYGEN_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      leadmagic: !!process.env.LEADMAGIC_API_KEY,
      gmail: gmailEnabled(),
      linkedinManaged: !!(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY),
      resend: !!process.env.RESEND_API_KEY,
    },
  }, noStore);
}
