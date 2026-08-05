import { NextResponse } from "next/server";
import { consumeToken, appUrl } from "@/lib/tokens";
import { markEmailVerified } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing target of the verification link. Consumes the single-use token,
// flips emailVerified, then redirects to the friendly /verify page.
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  const rec = await consumeToken(token, "verify");
  if (!rec) return NextResponse.redirect(`${appUrl()}/verify?status=invalid`);
  await markEmailVerified(rec.email);
  return NextResponse.redirect(`${appUrl()}/verify?status=ok`);
}
