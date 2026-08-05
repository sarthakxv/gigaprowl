import { NextResponse } from "next/server";
import { login, createSessionToken, sessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientIp = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

export async function POST(req) {
  try {
    const { allowed } = await rateLimit("login", clientIp(req), 10, 900); // 10 / 15 min
    if (!allowed) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const { email, password } = await req.json();
    const user = await login(email, password);
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(sessionCookie(createSessionToken(user.id)));
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
