import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reconciliation is read-only. Only the verified, one-time callback may claim
// a provider account; the newest unowned account is never safe to adopt.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const state = await getUserState(userId);
  return NextResponse.json({
    ok: true,
    connected: !!state.connections?.linkedin?.accountId,
    name: state.connections?.linkedin?.name || null,
  });
}
