import { NextResponse } from "next/server";
import { updateUserState } from "@/lib/db";
import { claimCorrelatedUnipileAccount } from "@/lib/durable";
import { listLinkedInAccounts } from "@/lib/unipile";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const status = body.status || body.type;
    const accountId = body.account_id || body.accountId;
    const nonce = body.name;
    if (!/SUCCESS|CREATED|RECONNECTED|OK/i.test(String(status || "")) || !accountId || !nonce) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const secret = process.env.UNIPILE_CALLBACK_SECRET;
    const proof = new URL(req.url).searchParams.get("proof") || "";
    if (!secret || !/^[a-f0-9]{64}$/.test(proof)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const expected = crypto.createHmac("sha256", secret).update(nonce).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(proof, "hex"), Buffer.from(expected, "hex"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // This callback has no provider signature. Verify account existence with
    // Unipile, then consume an unguessable one-time correlation in Postgres.
    const accounts = await listLinkedInAccounts();
    const account = accounts.find((item) => item.accountId === accountId);
    if (!account) return NextResponse.json({ ok: false }, { status: 400 });
    const userId = await claimCorrelatedUnipileAccount(nonce, accountId);
    if (!userId) return NextResponse.json({ ok: false }, { status: 409 });
    await updateUserState(userId, (state) => {
      state.connections.linkedin = {
        provider: "unipile", accountId, name: account.name,
        connectedAt: new Date().toISOString(),
      };
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("linkedin callback failed:", error.message);
    return NextResponse.json({ error: "Connection could not be verified" }, { status: 503 });
  }
}
