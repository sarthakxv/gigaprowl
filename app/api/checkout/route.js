import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Consumer plans. Prices in cents; credits granted monthly via webhook.
export const PLANS = {
  plus: { name: "Prowl Plus", amount: 1900, credits: 50 },
  max: { name: "Prowl Max", amount: 4900, credits: 200 },
};

// POST { plan } → Stripe Checkout Session URL (subscription, inline price).
export async function POST(req) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return NextResponse.json({ error: "Payments not configured yet (STRIPE_SECRET_KEY missing)" }, { status: 501 });

    const { plan } = await req.json();
    const p = PLANS[plan];
    if (!p) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const base = `${req.headers.get("x-forwarded-proto") || "https"}://${host}`;

    const body = new URLSearchParams({
      mode: "subscription",
      success_url: `${base}/dashboard?upgraded=${plan}`,
      cancel_url: `${base}/pricing`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(p.amount),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": p.name,
      "metadata[userId]": userId,
      "metadata[plan]": plan,
      "subscription_data[metadata][userId]": userId,
      "subscription_data[metadata][plan]": plan,
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || `Stripe ${r.status}`);
    return NextResponse.json({ url: d.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
