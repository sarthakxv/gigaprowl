import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { dispatchStep } from "@/lib/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { cadenceId, stepIndex, mode? } → dispatch one cadence step now.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const { cadenceId, stepIndex, mode } = await req.json();

    const result = await dispatchStep(userId, cadenceId, stepIndex, mode);
    if (result.skipped) return NextResponse.json({ error: `Already ${result.status}` }, { status: 409 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || "Send failed";
    const status = /not connected|Connect Gmail|No email|No LinkedIn|not found/i.test(msg) ? 400
      : /isn't configured/i.test(msg) ? 501 : 500;
    if (status === 500) console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
