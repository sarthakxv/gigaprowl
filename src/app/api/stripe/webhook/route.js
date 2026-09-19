import { NextResponse } from "next/server";
import crypto from "crypto";
import { updateUserState } from "@/lib/db";
import { PLANS } from "@/app/api/checkout/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verify Stripe signature (t=...,v1=...) against the raw body.
function verifyStripeSig(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(parts.v1 || "", "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

// Grants credits on successful checkout + each renewal invoice.
export async function POST(req) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret && !verifyStripeSig(raw, req.headers.get("stripe-signature"), secret))
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }

  const grant = async (userId, planKey) => {
    const p = PLANS[planKey];
    if (!userId || !p) return;
    await updateUserState(userId, (s) => {
      s.credits.plan = planKey;
      s.credits.balance = Math.max(s.credits.balance, 0) + p.credits;
      s.credits.renewedAt = new Date().toISOString();
    });
  };

  try {
    if (event.type === "checkout.session.completed") {
      const m = event.data.object.metadata || {};
      await grant(m.userId, m.plan);
    } else if (event.type === "invoice.paid" && event.data.object.billing_reason === "subscription_cycle") {
      const m = event.data.object.subscription_details?.metadata || event.data.object.lines?.data?.[0]?.metadata || {};
      await grant(m.userId, m.plan);
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("webhook error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
