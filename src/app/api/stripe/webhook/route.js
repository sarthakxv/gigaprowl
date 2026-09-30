import { NextResponse } from "next/server";
import crypto from "crypto";
import { grantStripeEvent } from "@/lib/durable";
import { PLANS } from "@/app/api/checkout/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validSignature(raw, header, secret) {
  if (!secret || !header) return false;
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const rawTimestamp = parts.find(([key]) => key === "t")?.[1];
  const timestamp = Number(rawTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${rawTimestamp}.${raw}`).digest("hex");
  return parts.filter(([key]) => key === "v1").some(([, given]) =>
    /^[0-9a-f]{64}$/i.test(given || "") &&
    crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"))
  );
}

export async function POST(req) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }
  if (!event?.id || !event?.type) return NextResponse.json({ error: "Bad event" }, { status: 400 });
  let metadata = null;
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    if (event.data?.object?.payment_status !== "paid") {
      return NextResponse.json({ received: true, ignored: true });
    }
    metadata = event.data?.object?.metadata;
  }
  if (event.type === "invoice.paid" && event.data?.object?.billing_reason === "subscription_cycle") {
    metadata = event.data.object.subscription_details?.metadata || event.data.object.lines?.data?.[0]?.metadata;
  }
  if (!metadata) return NextResponse.json({ received: true, ignored: true });
  const plan = PLANS[metadata.plan];
  if (!plan || !metadata.userId) return NextResponse.json({ error: "Missing credit metadata" }, { status: 400 });
  try {
    await grantStripeEvent({ id: event.id, type: event.type, userId: metadata.userId }, { key: metadata.plan, credits: plan.credits });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe event failed:", error.message);
    return NextResponse.json({ error: "Could not record event" }, { status: 503 });
  }
}
