import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { updateUserState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { outreachMode: "manual" | "automated" } → update the user's send mode.
export async function POST(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { outreachMode, emailStyle } = await req.json().catch(() => ({}));
  const patch = {};
  if (outreachMode !== undefined) {
    if (!["manual", "automated"].includes(outreachMode))
      return NextResponse.json({ error: "outreachMode must be 'manual' or 'automated'" }, { status: 400 });
    patch.outreachMode = outreachMode;
  }
  if (emailStyle !== undefined) {
    if (!["standard", "founder_direct"].includes(emailStyle))
      return NextResponse.json({ error: "emailStyle must be 'standard' or 'founder_direct'" }, { status: 400 });
    patch.emailStyle = emailStyle;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  await updateUserState(userId, (s) => { s.settings = { ...(s.settings || {}), ...patch }; });
  return NextResponse.json({ ok: true, ...patch });
}
