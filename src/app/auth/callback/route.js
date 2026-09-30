import { NextResponse } from "next/server";
import { serverAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Redirect on the host that received the callback: the PKCE verifier and the
// session cookie set below are host-bound, so leaving for another origin would
// drop the freshly created session. `req.url` can carry the server's bind
// hostname rather than the browser's, so prefer the request headers.
function requestOrigin(req) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return url.origin;
  const proto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function GET(req) {
  const origin = requestOrigin(req);
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  const { error } = await serverAuth().auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  return NextResponse.redirect(new URL("/dashboard", origin));
}
