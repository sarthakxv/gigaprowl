import { NextResponse } from "next/server";
import crypto from "crypto";
import { recordResendEvent } from "@/lib/durable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validSignature(secret, headers, payload) {
  if (!secret) return false;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  const sentAt = Number(timestamp);
  if (!id || !signature || !Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) return false;
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest();
    return signature.split(" ").some((part) => {
      const value = part.startsWith("v1,") ? part.slice(3) : "";
      const given = Buffer.from(value, "base64");
      return given.length === expected.length && crypto.timingSafeEqual(given, expected);
    });
  } catch { return false; }
}

export async function POST(req) {
  const raw = await req.text();
  const id = req.headers.get("svix-id");
  if (!validSignature(process.env.RESEND_WEBHOOK_SECRET, req.headers, raw)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }
  const recipients = [].concat(event?.data?.to || event?.data?.email || []);
  try {
    await recordResendEvent(event.id || id, event.type || "unknown", recipients);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("resend event failed:", error.message);
    return NextResponse.json({ error: "Could not record event" }, { status: 503 });
  }
}
