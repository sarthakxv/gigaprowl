import { NextResponse } from "next/server";
import { getPitch } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public existence check for a pitch page. The pitch may still be generating
// (a hunt takes a moment), so the page polls this until it returns ready.
export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  const pitch = slug && (await getPitch(slug));
  return NextResponse.json({ ready: !!pitch });
}
