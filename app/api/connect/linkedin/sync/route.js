import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { updateUserState, getLinkedInOwner, claimLinkedInAccount } from "@/lib/db";
import { listLinkedInAccounts, unipileEnabled } from "@/lib/unipile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called right after the hosted-auth wizard redirects back. Reconciles the
// connection by asking Unipile which LinkedIn account is now linked and binding
// it to THIS user, but never an account already owned by another user (one
// shared Unipile key hosts everyone, so cross-assignment is the risk). Idempotent.
export async function POST(req) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!unipileEnabled()) return NextResponse.json({ error: "LinkedIn connection isn't available right now" }, { status: 501 });

  try {
    const accounts = await listLinkedInAccounts(); // newest first
    if (!accounts.length) return NextResponse.json({ ok: false, connected: false });

    // Figure out ownership of each candidate.
    const withOwner = await Promise.all(
      accounts.map(async (a) => ({ ...a, owner: await getLinkedInOwner(a.accountId) }))
    );

    // 1) Already mine → idempotent reconnect.
    let pick = withOwner.find((a) => a.owner === userId);
    // 2) An account explicitly tagged with my userId (if Unipile echoed it) and unowned.
    if (!pick) pick = withOwner.find((a) => a.tag === userId && !a.owner);
    // 3) Newest account not owned by anyone else.
    if (!pick) pick = withOwner.find((a) => !a.owner);

    if (!pick) {
      // Every connected account already belongs to other users. Refuse rather
      // than hijack someone else's LinkedIn.
      return NextResponse.json({ ok: false, connected: false, reason: "no_unclaimed_account" });
    }

    const claimed = await claimLinkedInAccount(pick.accountId, userId);
    if (!claimed) return NextResponse.json({ ok: false, connected: false, reason: "claim_conflict" });

    await updateUserState(userId, (s) => {
      s.connections.linkedin = {
        provider: "unipile",
        accountId: pick.accountId,
        name: pick.name,
        connectedAt: new Date().toISOString(),
      };
    });
    return NextResponse.json({ ok: true, connected: true, name: pick.name });
  } catch (e) {
    console.error("linkedin sync failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
