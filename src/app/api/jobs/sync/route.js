import { NextResponse } from "next/server";
import { syncAllSources } from "@/lib/sources";
import { getJobPool, setJobPool } from "@/lib/db";
import { cronUnauthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron hits GET on a schedule (see vercel.json). If CRON_SECRET is set,
// Vercel signs cron requests with it. Reject anything else so the worldwide
// scan only runs on our cadence, not on demand from strangers.
export async function GET(req) {
  if (cronUnauthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runScan();
}

// Global scans are privileged work; a public browser cannot trigger one.
export async function POST(req) {
  if (cronUnauthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runScan();
}

async function runScan() {
  try {
    let jobs = await syncAllSources();
    const pool = await getJobPool();
    let seeded = false;
    if (process.env.NODE_ENV !== "production" && jobs.length === 0 && pool.jobs.length === 0) {
      const { SEED_JOBS } = await import("@/lib/seed");
      jobs = SEED_JOBS;
      seeded = true;
    }
    const existing = new Set(pool.jobs.map((j) => j.sourceId));
    const fresh = jobs.filter((j) => !existing.has(j.sourceId));
    // Keep a bounded recent feed for matching. Postgres stores individual jobs;
    // the old KV blob-size limit no longer applies.
    pool.jobs = [...fresh, ...pool.jobs].slice(0, 1000);
    pool.lastSync = new Date().toISOString();
    pool.sources = jobs.reduce((m, j) => ((m[j.source] = (m[j.source] || 0) + 1), m), {});
    await setJobPool(pool);
    return NextResponse.json({ added: fresh.length, scanned: jobs.length, stored: pool.jobs.length, seeded, bySource: pool.sources });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
