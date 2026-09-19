import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState } from "@/lib/db";
import { sendResend, resendEnabled } from "@/lib/resend";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { to, subject, body }. Send a test email via Resend.
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (!resendEnabled()) return NextResponse.json({ error: "Resend not configured (RESEND_API_KEY)" }, { status: 501 });

    const { to, subject, body } = await req.json();
    if (!to) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
    const state = await getUserState(userId);
    const id = await sendResend({
      to,
      subject: subject || "Test from Gigaprowl",
      text: body || "This is a test email sent via Resend from Gigaprowl.",
      replyTo: state.profile?.email || undefined,
      fromName: state.profile?.name || "Gigaprowl",
    });
    return NextResponse.json({ ok: true, messageId: id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
