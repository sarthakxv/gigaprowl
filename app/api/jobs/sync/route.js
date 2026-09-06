import { NextResponse } from "next/server";
import { syncAllSources } from "@/lib/sources";
import { getJobPool, setJobPool } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron hits GET on a schedule (see vercel.json). If CRON_SECRET is set,
// Vercel signs cron requests with it. Reject anything else so the worldwide
// scan only runs on our cadence, not on demand from strangers.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runScan();
}

// Manual refresh (dashboard button). Supplementary to the scheduled scan.
export async function POST() {
  return runScan();
}

async function runScan() {
  try {
    let jobs = await syncAllSources();
    const pool = await getJobPool();
    let seeded = false;
    if (jobs.length === 0 && pool.jobs.length === 0) {
      const { SEED_JOBS } = await import("@/lib/seed");
      jobs = SEED_JOBS;
      seeded = true;
    }
    const existing = new Set(pool.jobs.map((j) => j.sourceId));
    const fresh = jobs.filter((j) => !existing.has(j.sourceId));
    // The KV value must fit the REST size limit (~1MB) or SET returns 413.
    // Trim descriptions and pack newest-first up to a byte budget so a big scan
    // can never overflow. (Past this, move the pool to Postgres.)
    const BUDGET = 900_000;
    const packed = [];
    let bytes = 0;
    for (const j of [...fresh, ...pool.jobs]) {
      const t = { ...j, description: (j.description || "").slice(0, 280) };
      const sz = JSON.stringify(t).length + 1;
      if (bytes + sz > BUDGET) break;
      packed.push(t);
      bytes += sz;
    }
    pool.jobs = packed;
    pool.lastSync = new Date().toISOString();
    pool.sources = jobs.reduce((m, j) => ((m[j.source] = (m[j.source] || 0) + 1), m), {});
    await setJobPool(pool);
    return NextResponse.json({ added: fresh.length, scanned: jobs.length, stored: pool.jobs.length, kb: Math.round(bytes / 1024), seeded, bySource: pool.sources });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
