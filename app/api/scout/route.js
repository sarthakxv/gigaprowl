import { NextResponse } from "next/server";
import { inferProfile, buildReport, saveScoutLead, isLinkedInUrl } from "@/lib/scout";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { linkedinUrl, email? }
//   Always returns the full report. Email is optional lead capture (no gate).
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { linkedinUrl, email } = body || {};
  if (!linkedinUrl || !isLinkedInUrl(linkedinUrl)) {
    return NextResponse.json({ error: "Please paste a valid LinkedIn profile URL (linkedin.com/in/...)." }, { status: 400 });
  }

  try {
    const profile = await inferProfile(linkedinUrl, { refresh: !!body.refresh });
    const result = await buildReport(linkedinUrl, profile, { windowHours: 48, limit: 3 });

    // No gate: always return the full report. Email is optional. If provided,
    // we capture it as a lead, but it never blocks the results.
    if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      try {
        await saveScoutLead({ email, linkedinUrl, profile: result.profile, matches: result.matches });
      } catch (e) {
        console.error("lead save failed (non-fatal):", e.message);
      }
    }
    return NextResponse.json({ status: "done", locked: false, ...result });
  } catch (e) {
    console.error("scout route failed:", e);
    return NextResponse.json({ error: "Scan failed. Try again in a moment." }, { status: 500 });
  }
}
