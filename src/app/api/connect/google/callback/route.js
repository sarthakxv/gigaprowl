import { NextResponse } from "next/server";
import { getSessionBinding, getUserId } from "@/lib/auth";
import {
  consumeGoogleOAuthState,
  exchangeCode,
  saveGmailConnection,
  GmailError,
  gmailDashboardUrl,
} from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_MAP = {
  no_refresh: "gmail_no_refresh",
  insufficient_scope: "gmail_scope",
  unverified: "gmail_unverified",
  storage: "gmail_storage",
};

function back(code) {
  return NextResponse.redirect(gmailDashboardUrl(code));
}

// Google redirects here with ?code&state. State is a one-time nonce; we never
// trust forwarded Host headers for the redirect back to the dashboard.
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err === "access_denied") return back("gmail_denied");
  if (err) return back("gmail_error");

  const cookieUser = getUserId(req);
  const sessionBinding = getSessionBinding(req);
  if (!cookieUser || !sessionBinding || !code) return back("gmail_bad_state");

  const rec = await consumeGoogleOAuthState(state, sessionBinding);
  if (!rec?.userId) return back("gmail_bad_state");
  if (cookieUser !== rec.userId) return back("gmail_bad_state");

  try {
    const grant = await exchangeCode(code);
    await saveGmailConnection(rec.userId, grant);
    return back("gmail_ok");
  } catch (e) {
    console.error("gmail oauth callback:", e?.code || e?.message);
    if (e instanceof GmailError) return back(CODE_MAP[e.code] || "gmail_error");
    return back("gmail_error");
  }
}
