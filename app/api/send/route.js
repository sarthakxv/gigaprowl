import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { dispatchStep } from "@/lib/dispatch";
import { GmailError } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { cadenceId, stepIndex } → dispatch one cadence step now.
// Email mode always comes from the user's stored outreach setting.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const { cadenceId, stepIndex } = await req.json();

    const result = await dispatchStep(userId, cadenceId, stepIndex);
    if (result.skipped) return NextResponse.json({ error: `Already ${result.status}` }, { status: 409 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || "Send failed";
    const code = e instanceof GmailError ? e.code : "";
    const status = code === "in_progress" || /already/i.test(msg) ? 409
      : code === "daily_cap" ? 429
      : code === "delivery_uncertain" ? 502
      : code === "unconfigured" || /isn't configured/i.test(msg) ? 501
      : e.reauth || /not connected|Reconnect Gmail|Connect Gmail|No email|No LinkedIn|not found|suppressed|invalid recipient/i.test(msg) ? 400
      : 500;
    if (status === 500) console.error(e);
    return NextResponse.json({ error: msg, code: code || undefined }, { status });
  }
}
