import { NextResponse } from "next/server";
import crypto from "crypto";
import { addSuppression, kvSet } from "@/lib/db";
import { kvKeys } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resend delivery webhooks (signed via Svix). Set RESEND_WEBHOOK_SECRET to the
// "whsec_..." signing secret from the Resend dashboard → Webhooks.
// Hard bounces + spam complaints are added to the suppression list so we never
// email that address again. This is what protects sender reputation at scale.

function verifySvix(secret, headers, payload) {
  if (!secret) return true; // if unset, accept (dev). Set it in prod!
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${ts}.${payload}`;
  const expected = crypto.createHmac("sha256", key).update(signed).digest("base64");
  // Header may carry multiple space-separated "v1,<sig>" values.
  return sigHeader.split(" ").some((p) => {
    const sig = p.includes(",") ? p.split(",")[1] : p;
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
  });
}

export async function POST(req) {
  const raw = await req.text();
  if (!verifySvix(process.env.RESEND_WEBHOOK_SECRET, req.headers, raw)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let evt;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  const type = evt.type || "";
  const recipients = [].concat(evt?.data?.to || evt?.data?.email || []);

  try {
    if (type === "email.bounced" || type === "email.complained") {
      for (const to of recipients) await addSuppression(to, type.replace("email.", ""));
    }
    // Lightweight per-event audit trail (last event per message id).
    if (evt?.data?.email_id) {
      await kvSet(kvKeys.mailEvent(evt.data.email_id), { type, at: new Date().toISOString(), to: recipients });
    }
  } catch (e) {
    console.error("resend webhook handling failed:", e.message);
  }
  return NextResponse.json({ ok: true });
}
