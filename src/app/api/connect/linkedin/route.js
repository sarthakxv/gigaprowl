import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { hostedAuthLink, unipileEnabled } from "@/lib/unipile";
import { requestBase } from "@/lib/hunt";
import { createUnipileCorrelation } from "@/lib/durable";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → returns { url } of Unipile's hosted LinkedIn-connect wizard.
// The dashboard opens it; on success Unipile pings our callback with account_id.
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!unipileEnabled())
    return NextResponse.json({ error: "LinkedIn connection isn't available right now" }, { status: 501 });
  if (!process.env.UNIPILE_CALLBACK_SECRET)
    return NextResponse.json({ error: "LinkedIn connection isn't configured" }, { status: 503 });
  try {
    const nonce = await createUnipileCorrelation(userId);
    const proof = crypto.createHmac("sha256", process.env.UNIPILE_CALLBACK_SECRET).update(nonce).digest("hex");
    const d = await hostedAuthLink({ base: requestBase(req), name: nonce, proof });
    return NextResponse.json({ url: d.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
