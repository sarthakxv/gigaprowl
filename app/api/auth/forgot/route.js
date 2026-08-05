import { NextResponse } from "next/server";
import { getUserByEmail, rateLimit } from "@/lib/db";
import { createToken, appUrl } from "@/lib/tokens";
import { resendEnabled, sendSystemEmail } from "@/lib/resend";
import { resetEmail } from "@/lib/email-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientIp = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

// Request a password reset. ALWAYS returns 200 with the same message whether or
// not the account exists — prevents email-enumeration attacks.
export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  const generic = { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  // Rate-limit but still return the generic message (don't leak via status codes).
  const { allowed } = await rateLimit("forgot", clientIp(req), 5, 3600); // 5 / hour
  if (!allowed) return NextResponse.json(generic);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json(generic);

  try {
    const user = await getUserByEmail(email);
    if (user && resendEnabled()) {
      const token = await createToken("reset", { userId: user.id, email: user.email });
      const url = `${appUrl()}/reset?token=${token}`;
      const { subject, html, text } = resetEmail({ name: user.name, url });
      await sendSystemEmail({ to: user.email, subject, html, text });
    }
  } catch (e) {
    console.error("forgot-password email failed:", e.message);
  }
  return NextResponse.json(generic); // never reveal existence / send failures
}
