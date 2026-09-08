import { NextResponse } from "next/server";
import { getSessionBinding, getUserId } from "@/lib/auth";
import { googleAuthUrl, gmailEnabled, createGoogleOAuthState, gmailDashboardUrl } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → kick off Google OAuth. State is a single-use nonce bound to this exact session.
export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));
  if (!gmailEnabled()) return NextResponse.redirect(gmailDashboardUrl("gmail_unconfigured"));
  const sessionBinding = getSessionBinding(req);
  if (!sessionBinding) return NextResponse.redirect(new URL("/login", req.url));
  const state = await createGoogleOAuthState(userId, sessionBinding);
  return NextResponse.redirect(googleAuthUrl(state));
}
