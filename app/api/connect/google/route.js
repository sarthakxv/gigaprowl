import { NextResponse } from "next/server";
import { getUserId, createSessionToken } from "@/lib/auth";
import { googleAuthUrl, gmailEnabled } from "@/lib/gmail";
import { requestBase } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → kick off Google OAuth. State is a signed token so the callback can tie
// the grant back to this exact user without server-side session storage.
export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));
  const base = requestBase(req);
  if (!gmailEnabled())
    return NextResponse.redirect(new URL("/dashboard?connect=gmail_unconfigured", base));
  const state = createSessionToken(userId);
  return NextResponse.redirect(googleAuthUrl(base, state));
}
