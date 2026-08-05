import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState, updateUserState, getJobPool } from "@/lib/db";
import { generateCadence } from "@/lib/ai";
import { requestBase } from "@/lib/hunt";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { cadenceId, style } → regenerate an existing cadence's steps in the
// chosen email style ("standard" | "founder_direct"). Only rewrites un-sent
// steps' bodies; keeps everything already sent/queued.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const { cadenceId, style } = await req.json();
    if (!["standard", "founder_direct"].includes(style))
      return NextResponse.json({ error: "style must be 'standard' or 'founder_direct'" }, { status: 400 });

    const [state, pool] = await Promise.all([getUserState(userId), getJobPool()]);
    const cadence = state.cadences.find((c) => c.id === cadenceId);
    if (!cadence) return NextResponse.json({ error: "Cadence not found" }, { status: 404 });
    const contact = state.contacts.find((c) => c.id === cadence.contactId) || { firstName: cadence.contactName?.split(" ")[0], title: cadence.contactTitle };
    const job = pool.jobs.find((j) => j.sourceId === cadence.matchId) || { title: cadence.jobTitle, company: cadence.company, description: "" };
    const ref = state.pitchRefs.find((p) => p.matchId === cadence.matchId);
    const pitchUrl = ref?.url || `${requestBase(req)}/p/${ref?.slug || ""}`;

    const fresh = await generateCadence(state.profile, job, contact, ref?.signal || null, style);

    await updateUserState(userId, (s) => {
      const cad = s.cadences.find((c) => c.id === cadenceId);
      if (!cad) return;
      cad.steps = fresh.steps.map((st) => {
        const tracked = `${pitchUrl}?ref=${encodeURIComponent(st.channel || "outreach")}&d=${st.day}`;
        return { ...st, body: (st.body || "").replaceAll("{{pitch_url}}", tracked), status: "draft" };
      });
      cad.style = style;
    });

    return NextResponse.json({ ok: true, style, steps: fresh.steps.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
