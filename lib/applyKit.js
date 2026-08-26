// Apply-kit persistence — shared by /api/apply-kit (one match) and
// /api/autopilot (mid-tier batch). A kit is ATS copy (bullets + apply note),
// not a hunt: 0 credits, no contacts / pitch page / cadence.
import { updateUserState, uid } from "@/lib/db";

export function hasApplyKit(state, matchId) {
  return (state.applyKits || []).some((x) => x.matchId === matchId);
}

export function buildApplyKitRecord({ kit, job, score }) {
  return {
    id: uid("kit"),
    matchId: job.sourceId,
    score,
    job: {
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location || null,
    },
    bullets: kit.bullets || [],
    applyNote: kit.applyNote || "",
    fitNote: kit.fitNote || "",
    createdAt: new Date().toISOString(),
  };
}

export async function persistApplyKits(userId, records) {
  if (!records.length) return;
  await updateUserState(userId, (s) => {
    if (!Array.isArray(s.applyKits)) s.applyKits = [];
    for (const k of records) {
      if (s.applyKits.some((x) => x.matchId === k.matchId)) continue;
      s.applyKits.push(k);
      const st = s.statusById[k.matchId];
      if (!st || st === "new") s.statusById[k.matchId] = "apply_kit_ready";
    }
  });
}
