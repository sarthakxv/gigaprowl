import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const user = await getUserById(userId);
  return NextResponse.json({
    userId,
    email: user?.email || null,
    name: user?.name || null,
    emailVerified: user?.emailVerified ?? true, // pre-existing accounts treated as verified
  });
}
