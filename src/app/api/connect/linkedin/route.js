import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { hostedAuthLink, unipileEnabled } from "@/lib/unipile";
import { requestBase } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → returns { url } of Unipile's hosted LinkedIn-connect wizard.
// The dashboard opens it; on success Unipile pings our callback with account_id.
export async function GET(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!unipileEnabled())
    return NextResponse.json({ error: "LinkedIn connection isn't available right now" }, { status: 501 });
  try {
    const d = await hostedAuthLink({ base: requestBase(req), name: userId });
    return NextResponse.json({ url: d.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
