import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState, updateUserState, releaseLinkedInAccount } from "@/lib/db";
import { revokeExtensionTokens } from "@/lib/extension-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const state = await getUserState(userId);
  const accountId = state.connections?.linkedin?.accountId;
  await updateUserState(userId, (s) => {
    s.connections.linkedin = null;
    s.connections.linkedinExt = null;
    for (const action of s.linkedinQueue || []) {
      if (action.status === "pending") action.status = "cancelled";
    }
  });
  if (accountId) await releaseLinkedInAccount(accountId, userId);
  await revokeExtensionTokens(userId);
  return NextResponse.json({ ok: true });
}
