import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserById, bumpDailyCounter } from "@/lib/db";
import { createToken, appUrl } from "@/lib/tokens";
import { resendEnabled, sendSystemEmail } from "@/lib/resend";
import { verifyEmail } from "@/lib/email-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resend the verification email to the signed-in user (max 5/day).
export async function POST(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });
  if (!resendEnabled()) return NextResponse.json({ error: "Email sending not configured" }, { status: 503 });

  const { allowed } = await bumpDailyCounter(userId, "verifymail", 5);
  if (!allowed) return NextResponse.json({ error: "Too many requests — try again tomorrow" }, { status: 429 });

  const token = await createToken("verify", { userId: user.id, email: user.email });
  const url = `${appUrl()}/api/auth/verify?token=${token}`;
  const { subject, html, text } = verifyEmail({ name: user.name, url });
  await sendSystemEmail({ to: user.email, subject, html, text });
  return NextResponse.json({ ok: true });
}
