import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { updateUserState } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { cadenceId } = await req.json().catch(() => ({}));
  if (typeof cadenceId !== "string" || cadenceId.length > 100) {
    return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
  }
  try {
    const approved = await updateUserState(userId, (state) => {
      const cadence = state.cadences.find((item) => item.id === cadenceId);
      if (!cadence) return false;
      const contact = state.contacts.find((item) => item.id === cadence.contactId);
      if (!contact || !cadence.steps?.length) return false;
      if (cadence.steps.some((step) => step.status !== "draft" || !step.body)) return false;
      cadence.approvalStatus = "approved";
      cadence.approvedAt = new Date().toISOString();
      for (const step of cadence.steps) step.status = "pending";
      return true;
    });
    if (!approved) return NextResponse.json({ error: "Cadence is not ready for approval" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("cadence approval failed:", error.message);
    return NextResponse.json({ error: "Approval could not be saved" }, { status: 503 });
  }
}
