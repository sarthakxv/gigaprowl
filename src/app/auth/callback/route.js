import { NextResponse } from "next/server";
import { serverAuth } from "@/lib/auth";
import { appUrl } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=invalid_link", appUrl()));
  const { error } = await serverAuth().auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=invalid_link", appUrl()));
  return NextResponse.redirect(new URL("/dashboard", appUrl()));
}
