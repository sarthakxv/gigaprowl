import { NextResponse } from "next/server";
import { signup, createSessionToken, sessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientIp = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

export async function POST(req) {
  try {
    const { allowed } = await rateLimit("signup", clientIp(req), 5, 3600); // 5 / hour
    if (!allowed) return NextResponse.json({ error: "Too many signups from this network. Try again later." }, { status: 429 });
    const { email, password, name } = await req.json();
    const user = await signup(email, password, name);

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, emailVerified: true },
    });
    res.cookies.set(sessionCookie(createSessionToken(user.id)));
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
