import { NextResponse } from "next/server";
import { updateUserState, getLinkedInOwner, claimLinkedInAccount } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unipile notify_url. Fires when the user finishes (or fails) the hosted connect.
// Body includes { status, account_id, name } — name is the userId we passed in.
// This is the RELIABLE per-user mapping (account_id tied to the exact user who
// started the session), so it's the primary path; the /sync route is a backup.
export async function POST(req) {
  try {
    const b = await req.json().catch(() => ({}));
    const status = b.status || b.type;
    const userId = b.name;
    const accountId = b.account_id || b.accountId;
    if (userId && accountId && /SUCCESS|CREATED|RECONNECTED|OK/i.test(String(status || "success"))) {
      // Bind the account to this user, unless another user already owns it.
      const owner = await getLinkedInOwner(accountId);
      if (!owner || owner === userId) {
        await claimLinkedInAccount(accountId, userId);
        await updateUserState(userId, (s) => {
          s.connections.linkedin = {
            provider: "unipile",
            accountId,
            name: b.account_name || b.username || null,
            connectedAt: new Date().toISOString(),
          };
        });
      } else {
        console.warn("linkedin callback: account already owned by another user", accountId);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 200 }); // never make Unipile retry-storm us
  }
}
