import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { disconnectGmail } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await disconnectGmail(userId);
  return NextResponse.json({ ok: true });
}
