import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState, getUserById, rateLimit } from "@/lib/db";
import { sendResend, resendEnabled } from "@/lib/resend";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { to, subject, body }. Send a test email via Resend to the signed-in
// account's own address only; the shared sender must never become a relay.
export async function POST(req) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (!resendEnabled()) return NextResponse.json({ error: "Resend not configured (RESEND_API_KEY)" }, { status: 501 });

    const { to, subject, body } = await req.json().catch(() => ({}));
    if (typeof to !== "string" || !to) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
    if ((subject != null && typeof subject !== "string") || (body != null && typeof body !== "string")) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }
    const account = await getUserById(userId);
    if (!account?.email || to.trim().toLowerCase() !== account.email) {
      return NextResponse.json({ error: "Test emails can only go to your account email" }, { status: 403 });
    }
    const { allowed } = await rateLimit("test-email", userId, 5, 3600);
    if (!allowed) return NextResponse.json({ error: "Too many test emails. Try again later." }, { status: 429 });
    const state = await getUserState(userId);
    const id = await sendResend({
      to: account.email,
      subject: (subject || "Test from Gigaprowl").slice(0, 200),
      text: (body || "This is a test email sent via Resend from Gigaprowl.").slice(0, 5000),
      replyTo: state.profile?.email || undefined,
      fromName: state.profile?.name || "Gigaprowl",
    });
    return NextResponse.json({ ok: true, messageId: id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
