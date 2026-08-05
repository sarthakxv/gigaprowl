import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { exchangeCode } from "@/lib/gmail";
import { updateUserState } from "@/lib/db";
import { requestBase } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google redirects here with ?code&state. We verify state → userId, swap the
// code for a refresh token, and store the connected Gmail address.
export async function GET(req) {
  const base = requestBase(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL("/dashboard?connect=gmail_denied", base));

  const userId = verifySessionToken(state);
  if (!userId || !code) return NextResponse.redirect(new URL("/dashboard?connect=gmail_bad_state", base));

  try {
    const { refreshToken, email } = await exchangeCode(base, code);
    if (!refreshToken) return NextResponse.redirect(new URL("/dashboard?connect=gmail_no_refresh", base));
    await updateUserState(userId, (s) => {
      s.connections.gmail = { email, refreshToken, connectedAt: new Date().toISOString() };
    });
    return NextResponse.redirect(new URL("/dashboard?connect=gmail_ok", base));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/dashboard?connect=gmail_error", base));
  }
}
