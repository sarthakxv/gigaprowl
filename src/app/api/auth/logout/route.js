import { NextResponse } from "next/server";
import { getUserId, serverAuth } from "@/lib/auth";
import { revokeExtensionTokens } from "@/lib/extension-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (userId) await revokeExtensionTokens(userId);
  const { error } = await serverAuth().auth.signOut({ scope: "global" });
  if (error) return NextResponse.json({ error: "Could not sign out" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
