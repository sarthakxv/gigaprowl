// Hiring-signal provider.
//
// A "hiring signal" = evidence a company is actively scaling a team right now
// (a surge in open roles, a recent funding round, a new engineering leader).
// It is used to (a) boost a match's score and (b) give outreach a specific,
// timely personalization hook ("saw you're spinning up the payments team…").
//
// Parallel API (parallel.ai) is the real source when PARALLEL_API_KEY is set.
// Until keys + endpoint are wired, we fall back to a deterministic mock so the
// whole pipeline is testable without spending credits and never breaks.

import { parallelEnabled, runParallelTask } from "@/lib/parallel";

// "base" is the cheapest/fastest processor. Plenty for a hiring-signal lookup.
const PARALLEL_PROCESSOR = process.env.PARALLEL_PROCESSOR || "base";
// Hard time budget so a slow research run can't blow the outreach route's
// maxDuration. On timeout we quietly fall back to the mock signal.
const PARALLEL_TIMEOUT_MS = Number(process.env.PARALLEL_TIMEOUT_MS || 20000);

const SIGNAL_INPUT_SCHEMA = {
  type: "object",
  properties: { company_name: { type: "string", description: "Company to research hiring signals for" } },
  required: ["company_name"],
};

const SIGNAL_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    is_hiring: { type: "string", enum: ["yes", "no"], description: "Whether the company is actively hiring / scaling its engineering or product teams right now." },
    open_roles: { type: "string", description: "Approximate number of currently open engineering/product roles, as a number in string form (e.g. '7'). Use '0' if unknown." },
    recent_event: { type: "string", description: "A recent hiring-relevant event in the last ~6 months (e.g. 'raised a $50M Series B', 'hired a new VP of Engineering', 'expanding the platform team'), or 'none'." },
    summary: { type: "string", description: "One or two sentences on the company's current hiring momentum." },
  },
  required: ["is_hiring", "open_roles", "recent_event", "summary"],
  additionalProperties: false,
};

// ---- Parallel Task API: research this company's current hiring momentum ----
// run a task → normalize its structured result into our signal shape.
async function fetchParallelSignal(company) {
  try {
    const content = await runParallelTask({
      input: { company_name: company },
      inputSchema: SIGNAL_INPUT_SCHEMA,
      outputSchema: SIGNAL_OUTPUT_SCHEMA,
      processor: PARALLEL_PROCESSOR,
      timeoutMs: PARALLEL_TIMEOUT_MS,
    });
    return normalizeParallel(content, company);
  } catch (e) {
    console.error("Parallel signal fetch failed, using mock:", e.message);
    return null; // → caller falls back to the mock signal
  }
}

// Shape Parallel's Task Run Result into our signal object.
function normalizeParallel(content, company) {
  const parsedRoles = parseInt(content.open_roles, 10);
  const openRoles = Number.isFinite(parsedRoles) ? parsedRoles : 0;
  const eventRaw = (content.recent_event || "").trim();
  const event = eventRaw && !/^none$/i.test(eventRaw) ? eventRaw : null;
  const hiring = /^y/i.test(content.is_hiring || "") || openRoles > 2 || !!event;
  // Derive a 0–1 intensity from the concrete signals we got back.
  const intensity = Math.max(0, Math.min(1,
    (hiring ? 0.4 : 0) + Math.min(0.4, openRoles * 0.05) + (event ? 0.2 : 0)
  ));
  return {
    company,
    hiring,
    intensity: Math.round(intensity * 100) / 100,
    openRoles,
    event,
    summary: content.summary || (hiring ? `${company} appears to be hiring.` : `No strong hiring surge detected for ${company}.`),
    source: "parallel",
  };
}

// Deterministic pseudo-signal so demos/tests are stable per company name.
function mockSignal(company) {
  const c = (company || "").toLowerCase();
  let h = 0;
  for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const intensity = (h % 100) / 100; // 0..1
  const openRoles = 1 + (h % 12); // 1..12
  const events = ["a recent funding round", "new engineering leadership", "a fast-growing team"];
  const event = intensity > 0.55 ? events[h % events.length] : null;
  const hiring = intensity > 0.4;
  return {
    company,
    hiring,
    intensity: Math.round(intensity * 100) / 100,
    openRoles,
    event,
    summary: hiring
      ? `${company} appears to be scaling. ~${openRoles} open role${openRoles > 1 ? "s" : ""}${event ? `, ${event}` : ""}.`
      : `No strong hiring surge detected for ${company} right now.`,
    source: "mock",
  };
}

export async function getHiringSignal(company) {
  if (!company) return null;
  if (parallelEnabled()) {
    const real = await fetchParallelSignal(company);
    if (real) return { ...real, source: "parallel" };
  }
  if (process.env.NODE_ENV === "production") return null;
  return mockSignal(company);
}

// Score boost (0–15) a hiring signal contributes to a match.
export function signalScoreBoost(signal) {
  if (!signal || !signal.hiring) return 0;
  return Math.round(signal.intensity * 12 + (signal.event ? 3 : 0));
}
