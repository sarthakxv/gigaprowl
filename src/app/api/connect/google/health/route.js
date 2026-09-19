import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState } from "@/lib/db";
import {
  gmailEnabled,
  isLegacyGmailConnection,
  validateGmailConnection,
  touchGmailValidated,
  markGmailError,
  markGmailStatus,
  GmailError,
} from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!gmailEnabled()) return NextResponse.json({ error: "Gmail isn't configured" }, { status: 501 });

  const state = await getUserState(userId);
  const gmail = state.connections?.gmail;
  if (!gmail) return NextResponse.json({ error: "Gmail is not connected", reconnectRequired: true }, { status: 404 });
  if (isLegacyGmailConnection(gmail) || !gmail.encryptedRefreshToken) {
    await markGmailStatus(userId, "reauth_required", "legacy_or_invalid");
    return NextResponse.json({ ok: false, reconnectRequired: true, error: "Reconnect Gmail" }, { status: 409 });
  }

  try {
    await validateGmailConnection(gmail);
    await touchGmailValidated(userId);
    return NextResponse.json({ ok: true, email: gmail.email, status: "connected" });
  } catch (e) {
    const reauth = e instanceof GmailError && e.reauth;
    if (reauth) await markGmailStatus(userId, "reauth_required", e.code);
    else await markGmailError(userId, e.code || "error");
    return NextResponse.json(
      { ok: false, reconnectRequired: !!reauth, error: e.message || "Gmail health check failed" },
      { status: reauth ? 409 : 502 },
    );
  }
}
