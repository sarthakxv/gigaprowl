import { NextResponse } from "next/server";
import { consumeToken, peekToken } from "@/lib/tokens";
import { setUserPassword, createSessionToken, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?token=  validate a reset token without spending it (so the form can
// show "link expired" before the user types a new password).
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  const rec = await peekToken(token, "reset");
  return NextResponse.json({ valid: !!rec, email: rec?.email || null });
}

// POST { token, password }. Spend the token, set the new password, sign in.
export async function POST(req) {
  try {
    const { token, password } = await req.json();
    const rec = await consumeToken(token, "reset"); // single-use
    if (!rec) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    const user = await setUserPassword(rec.email, password);
    const res = NextResponse.json({ ok: true, email: user.email });
    res.cookies.set(sessionCookie(createSessionToken(user.id))); // log them straight in
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
