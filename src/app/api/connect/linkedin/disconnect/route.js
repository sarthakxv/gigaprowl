import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState, updateUserState, releaseLinkedInAccount } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const state = await getUserState(userId);
  const accountId = state.connections?.linkedin?.accountId;
  await updateUserState(userId, (s) => {
    s.connections.linkedin = null;
  });
  if (accountId) await releaseLinkedInAccount(accountId, userId);
  return NextResponse.json({ ok: true });
}
