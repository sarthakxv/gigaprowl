import { NextResponse } from "next/server";
import { syncAllSources, balanceBySource } from "@/lib/sources";
import { getJobPool, setJobPool } from "@/lib/db";
import { cronUnauthorized } from "@/lib/cron-auth";
import { JOB_POOL_CAP } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron hits GET on a schedule (see vercel.json) and signs it with
// CRON_SECRET. Reject anything else so the worldwide scan only runs on our
// cadence; users never trigger it, they rank against the stored pool.
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
    // Keep a bounded recent feed for matching. This scan's copy of a job wins;
    // earlier jobs stay only while a source has room left in the feed.
    const scanned = new Set(jobs.map((j) => j.sourceId));
    const carried = pool.jobs.filter((j) => !scanned.has(j.sourceId));
    pool.jobs = balanceBySource([...jobs, ...carried], JOB_POOL_CAP);
    pool.lastSync = new Date().toISOString();
    pool.sources = jobs.reduce((m, j) => ((m[j.source] = (m[j.source] || 0) + 1), m), {});
    const added = await setJobPool(pool);
    return NextResponse.json({ added, scanned: jobs.length, stored: pool.jobs.length, seeded, bySource: pool.sources });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
