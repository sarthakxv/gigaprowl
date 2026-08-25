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

const PARALLEL_KEY = process.env.PARALLEL_API_KEY;
const PARALLEL_BASE = "https://api.parallel.ai/v1";
// "base" is the cheapest/fastest processor. Plenty for a hiring-signal lookup.
const PARALLEL_PROCESSOR = process.env.PARALLEL_PROCESSOR || "base";
// Hard time budget so a slow research run can't blow the outreach route's
// maxDuration. On timeout we quietly fall back to the mock signal.
const PARALLEL_TIMEOUT_MS = Number(process.env.PARALLEL_TIMEOUT_MS || 20000);

export const signalsEnabled = () => !!PARALLEL_KEY;

// ---- Parallel Task API: research this company's current hiring momentum ----
// create a task run → block on its result → normalize into our signal shape.
async function fetchParallelSignal(company) {
  try {
    const createRes = await fetch(`${PARALLEL_BASE}/tasks/runs`, {
      method: "POST",
      headers: { "x-api-key": PARALLEL_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { company_name: company },
        processor: PARALLEL_PROCESSOR,
        task_spec: {
          input_schema: {
            type: "json",
            json_schema: {
              type: "object",
              properties: { company_name: { type: "string", description: "Company to research hiring signals for" } },
              required: ["company_name"],
            },
          },
          output_schema: {
            type: "json",
            json_schema: {
              type: "object",
              properties: {
                is_hiring: { type: "string", enum: ["yes", "no"], description: "Whether the company is actively hiring / scaling its engineering or product teams right now." },
                open_roles: { type: "string", description: "Approximate number of currently open engineering/product roles, as a number in string form (e.g. '7'). Use '0' if unknown." },
                recent_event: { type: "string", description: "A recent hiring-relevant event in the last ~6 months (e.g. 'raised a $50M Series B', 'hired a new VP of Engineering', 'expanding the platform team'), or 'none'." },
                summary: { type: "string", description: "One or two sentences on the company's current hiring momentum." },
              },
              required: ["is_hiring", "open_roles", "recent_event", "summary"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!createRes.ok) throw new Error(`create ${createRes.status} ${(await createRes.text()).slice(0, 160)}`);
    const { run_id } = await createRes.json();
    if (!run_id) throw new Error("no run_id in create response");

    // The result endpoint blocks server-side until the run completes.
    const resultRes = await fetch(`${PARALLEL_BASE}/tasks/runs/${run_id}/result`, {
      headers: { "x-api-key": PARALLEL_KEY },
      signal: AbortSignal.timeout(PARALLEL_TIMEOUT_MS),
    });
    if (!resultRes.ok) throw new Error(`result ${resultRes.status}`);
    return normalizeParallel(await resultRes.json(), company);
  } catch (e) {
    console.error("Parallel signal fetch failed, using mock:", e.message);
    return null; // → caller falls back to the mock signal
  }
}

// Shape Parallel's Task Run Result into our signal object.
function normalizeParallel(data, company) {
  const content = data?.output?.content;
  if (!content || typeof content !== "object") return null;
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
  if (PARALLEL_KEY) {
    const real = await fetchParallelSignal(company);
    if (real) return { ...real, source: "parallel" };
  }
  return mockSignal(company);
}

// Score boost (0–15) a hiring signal contributes to a match.
export function signalScoreBoost(signal) {
  if (!signal || !signal.hiring) return 0;
  return Math.round(signal.intensity * 12 + (signal.event ? 3 : 0));
}

// One-line, first-person personalization hook for outreach (email / LinkedIn).
export function signalHook(signal) {
  if (!signal || !signal.hiring) return null;
  if (signal.event) return `I noticed ${signal.company} is scaling (${signal.event})`;
  return `I noticed ${signal.company} has several open roles right now`;
}
