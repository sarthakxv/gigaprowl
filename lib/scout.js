// Gigaprowl Scout — the product-led-growth mini app.
//
// Flow: paste a LinkedIn URL → infer the person's profile → pull jobs posted in
// the last 48h from the live sources → score the matches → surface the top few.
// The full report is gated behind an email (the PLG lead capture).
//
// Everything degrades gracefully: no AI key → a heuristic demo profile; no live
// jobs → the seed pool, so the mini app always renders something real-looking.

import { hasAI, claudeJSON, classifyDiscipline } from "@/lib/ai";
import { rankJobs } from "@/lib/match";
import { fetchRemotive, fetchArbeitnow, fetchRemoteOK, fetchAdzuna } from "@/lib/sources";
import { getJobPool } from "@/lib/db";
import { kvGet, kvSet } from "@/lib/db";
import { identifierFromUrl } from "@/lib/unipile";

const PARALLEL_KEY = process.env.PARALLEL_API_KEY;
const PARALLEL_BASE = "https://api.parallel.ai/v1";
// Async pattern: we start a run, return immediately, and the page polls until it
// completes — so Parallel can take as long as it needs (no 60s function limit)
// and we can use a thorough processor for an accurate read.
const PARALLEL_PROFILE_PROCESSOR = process.env.PARALLEL_PROFILE_PROCESSOR || "base";

// ---- LinkedIn URL → handle ---------------------------------------------------
export function handleFromUrl(url = "") {
  const m = String(url).match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).replace(/-+/g, " ").trim() : null;
}

export function isLinkedInUrl(url = "") {
  return /linkedin\.com\/in\//i.test(String(url));
}

// ---- Profile reading ---------------------------------------------------------
// Three tiers, best first:
//   1) REAL read of the public LinkedIn profile via the Parallel web-research API
//      (source: "linkedin"). This actually looks the person up on the web.
//   2) Claude inference from the URL/handle (source: "ai") — an estimate.
//   3) A sensible demo profile (source: "demo") so the app never hard-fails.
// The matcher only needs: skills[], topSkills[], roles[], seniority, orientation.
const DEMO_PROFILE = {
  name: "You",
  title: "Software Engineer",
  seniority: "senior",
  discipline: "engineering",
  orientation: "product",
  skills: ["javascript", "typescript", "react", "node", "python", "aws", "postgres", "graphql", "docker", "rest"],
  topSkills: ["react", "typescript", "node", "aws", "python"],
  roles: ["Software Engineer", "Senior Engineer", "Full-Stack Developer", "Backend Engineer"],
  domains: ["technology"],
  summary: "I'm a senior full-stack engineer who ships product end-to-end across the modern web and cloud stack.",
};

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The person's full name as shown on their LinkedIn." },
    title: { type: "string", description: "Their CURRENT job title / headline." },
    company: { type: "string", description: "Their current employer, or empty string if unknown." },
    seniority: { type: "string", description: "One of: junior, mid, senior, staff, lead, executive." },
    discipline: { type: "string", description: "Primary craft: design, marketing, engineering, security, data, product, sales, or other." },
    orientation: { type: "string", description: "product, services, or hybrid — based on the kind of companies they've worked at." },
    skills: { type: "array", items: { type: "string" }, description: "Up to 16 lowercase skills/technologies from their profile (skills section, experience, headline)." },
    topSkills: { type: "array", items: { type: "string" }, description: "Their 5-6 strongest lowercase skills." },
    roles: { type: "array", items: { type: "string" }, description: "Up to 5 job titles they would be a strong match for." },
    domains: { type: "array", items: { type: "string" }, description: "Industries/domains they've worked in." },
    summary: { type: "string", description: "One first-person sentence starting with 'I' summarizing who they are professionally." },
    found: { type: "boolean", description: "true if you actually located and read this person's real LinkedIn/professional profile; false if you could not find them and had to guess." },
  },
  required: ["name", "title", "seniority", "discipline", "orientation", "skills", "topSkills", "roles", "summary", "found"],
  additionalProperties: false,
};

// Kick off a Parallel run that reads the public LinkedIn profile. Returns the
// run_id immediately (the run keeps executing on Parallel's side). Returns null
// on any failure so the caller can fall back to a synchronous estimate.
export async function startParallelRun(linkedinUrl) {
  if (!PARALLEL_KEY) return null;
  const handle = handleFromUrl(linkedinUrl) || "";
  try {
    const res = await fetch(`${PARALLEL_BASE}/tasks/runs`, {
      method: "POST",
      headers: { "x-api-key": PARALLEL_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: `Read this specific person's public LinkedIn profile at the exact URL below and extract an accurate structured summary for a job-matching engine. Base everything on THIS person's real profile and public web presence (their LinkedIn page, personal site, GitHub, company bio, talks). Do not confuse them with someone of a similar name. Capture their current role, employer, seniority, and real skills. LinkedIn URL: ${linkedinUrl}${handle ? ` (handle: ${handle})` : ""}. If you cannot confidently find THIS person, set "found" to false rather than guessing.`,
        processor: PARALLEL_PROFILE_PROCESSOR,
        task_spec: { output_schema: { type: "json", json_schema: PROFILE_SCHEMA } },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.error("scout: parallel create failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const d = await res.json();
    return d.run_id || d.id || null;
  } catch (e) {
    console.error("scout: parallel create threw:", e.message);
    return null;
  }
}

// Check a Parallel run. Returns { status:"running" } while in flight,
// { status:"failed" } if the run hard-failed, { status:"completed_empty" } if it
// finished but couldn't find the person, or { status:"completed", profile } once
// the real read is done. Relies on the /result endpoint (whose shape is known)
// rather than guessing status strings; only uses /status to catch hard failures.
export async function readParallelRun(runId, linkedinUrl) {
  const handle = handleFromUrl(linkedinUrl) || "this candidate";

  // Short-circuit on a hard failure so we don't poll forever.
  try {
    const statusRes = await fetch(`${PARALLEL_BASE}/tasks/runs/${runId}`, {
      headers: { "x-api-key": PARALLEL_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (statusRes.ok) {
      const s = ((await statusRes.json())?.status || "").toLowerCase();
      if (["failed", "cancelled", "canceled", "error"].includes(s)) return { status: "failed" };
    }
  } catch { /* ignore — fall through to result */ }

  // The result endpoint returns 202 while not ready, 200 with output.content when done.
  try {
    const resultRes = await fetch(`${PARALLEL_BASE}/tasks/runs/${runId}/result`, {
      headers: { "x-api-key": PARALLEL_KEY },
      signal: AbortSignal.timeout(12000),
    });
    if (resultRes.status === 202 || resultRes.status === 404) return { status: "running" };
    if (!resultRes.ok) return { status: "running" };
    const data = await resultRes.json();
    const c = data?.output?.content;
    if (!c) return { status: "running" };
    if (!c.name || c.found === false) return { status: "completed_empty" };
    return { status: "completed", profile: normalizeProfile(c, { handle, source: "linkedin" }) };
  } catch {
    // Timeout / transient — tell the client to keep polling.
    return { status: "running" };
  }
}

const DISCIPLINE_SKILLS = {
  design: ["figma", "ui", "ux", "design systems", "prototyping", "user research"],
  marketing: ["marketing", "seo", "growth", "content", "analytics", "campaigns"],
  data: ["python", "sql", "machine learning", "analytics", "etl", "pytorch"],
  product: ["product management", "roadmap", "analytics", "user research", "strategy"],
  sales: ["sales", "crm", "pipeline", "prospecting", "negotiation"],
  security: ["security", "appsec", "cloud security", "iam", "compliance"],
  engineering: ["javascript", "typescript", "react", "node", "python", "aws"],
  finance: ["financial analysis", "valuation", "financial modeling", "accounting", "investment", "advisory"],
  legal: ["legal research", "litigation", "compliance", "contracts", "due diligence"],
  consulting: ["strategy", "operations", "analysis", "project management", "stakeholder management"],
  other: ["analysis", "communication", "project management", "research", "strategy"],
};

// Domain-specific terms used ONLY for matching (not display). These are strong
// signals a job is in the person's field, so a finance role scores on "financial
// / valuation / investment" and a tech "analyst" role does not.
const DISCIPLINE_MATCH_TERMS = {
  finance: ["financial", "finance", "valuation", "investment", "advisory", "accounting", "audit", "equity", "capital markets", "portfolio", "banking", "m&a", "due diligence", "financial modeling", "fund", "corporate finance", "fp&a"],
  legal: ["legal", "litigation", "counsel", "compliance", "contracts", "paralegal", "regulatory", "due diligence"],
  consulting: ["consulting", "strategy", "operations", "advisory", "transformation", "stakeholder"],
  data: ["data", "analytics", "sql", "python", "machine learning", "etl", "dashboard", "bi"],
  product: ["product management", "roadmap", "product manager", "user research", "go-to-market"],
  design: ["design", "figma", "ux", "ui", "prototyping", "design system"],
  marketing: ["marketing", "seo", "growth", "content", "campaign", "brand", "demand gen"],
  sales: ["sales", "account executive", "crm", "pipeline", "quota", "business development"],
  security: ["security", "appsec", "infosec", "soc", "iam", "vulnerability"],
  engineering: ["software", "engineer", "developer", "backend", "frontend", "full-stack", "api"],
};

// A focused job-search query per discipline so relevant roles enter the pool.
const DISCIPLINE_QUERY = {
  finance: "financial analyst",
  legal: "legal counsel",
  consulting: "consultant",
  data: "data analyst",
  product: "product manager",
  design: "product designer",
  marketing: "marketing manager",
  sales: "account executive",
  security: "security engineer",
  engineering: "software engineer",
};

function normalizeProfile(p, { handle, source }) {
  const disc = p.discipline || "engineering";
  const defaults = DISCIPLINE_SKILLS[disc] || DISCIPLINE_SKILLS.engineering;
  const arr = (v, fb) => (Array.isArray(v) && v.length ? v : fb);
  const sen = ["junior", "mid", "senior", "staff", "lead", "executive"];
  const displaySkills = arr(p.topSkills, arr(p.skills, defaults).slice(0, 6)).map((s) => String(s).toLowerCase());
  // Matching set = the profile's own skills + domain terms for the discipline, so
  // in-field roles score on real signals and cross-domain roles don't.
  const matchSkills = [...new Set([
    ...arr(p.skills, defaults).map((s) => String(s).toLowerCase()),
    ...(DISCIPLINE_MATCH_TERMS[disc] || []),
  ])];
  return {
    ...DEMO_PROFILE,
    ...p,
    name: p.name || DEMO_PROFILE.name,
    title: p.title || DEMO_PROFILE.title,
    discipline: disc,
    seniority: sen.includes((p.seniority || "").toLowerCase()) ? p.seniority.toLowerCase() : "mid",
    skills: matchSkills,
    topSkills: displaySkills,
    roles: arr(p.roles, DEMO_PROFILE.roles),
    handle,
    source,
    inferred: source !== "linkedin",
  };
}

// ---- Real read via Unipile ---------------------------------------------------
// Reads the ACTUAL LinkedIn profile at the given URL through a connected LinkedIn
// account (authenticated view), so there's no name-collision / wrong-person risk.
const SKILL_VOCAB = [
  "javascript", "typescript", "react", "next.js", "node", "python", "go", "golang", "rust", "java",
  "kotlin", "swift", "aws", "gcp", "azure", "kubernetes", "docker", "terraform", "postgres", "mysql",
  "mongodb", "redis", "kafka", "machine learning", "deep learning", "pytorch", "tensorflow", "llm",
  "nlp", "data engineering", "spark", "airflow", "sql", "etl", "product management", "design", "figma",
  "devops", "sre", "security", "ios", "android", "react native", "graphql", "rest", "microservices",
  "ci/cd", "git", "ruby", "rails", "php", "django", "flask", "vue", "angular", "tailwind", "sales",
  "marketing", "seo", "growth", "analytics", "excel", "ui", "ux", "legal research", "litigation",
  "compliance", "due diligence", "financial modeling", "valuation", "accounting", "consulting",
  "operations", "recruiting", "content", "copywriting", "project management", "strategy",
];

function unipileOn() {
  return !!(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY);
}
function unipileDsn() {
  return (process.env.UNIPILE_DSN || "").replace(/\/$/, "");
}
async function unipileApi(path, timeoutMs = 15000) {
  const r = await fetch(`${unipileDsn()}${path}`, {
    headers: { "X-API-KEY": process.env.UNIPILE_API_KEY, accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`unipile ${path} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// The connected LinkedIn account we read through. Auto-discovered from the API
// (so we never hardcode the id), overridable via UNIPILE_ACCOUNT_ID.
let _acctCache = null;
async function unipileAccountId() {
  if (process.env.UNIPILE_ACCOUNT_ID) return process.env.UNIPILE_ACCOUNT_ID;
  if (_acctCache) return _acctCache;
  const d = await unipileApi("/api/v1/accounts");
  const items = Array.isArray(d) ? d : d.items || d.accounts || [];
  const li = items.find((a) => /LINKEDIN/i.test(a.type || a.provider || "")) || items[0];
  _acctCache = li?.id || null;
  return _acctCache;
}

function inferSeniority(text) {
  const t = (text || "").toLowerCase();
  if (/chief|\bceo\b|\bcto\b|\bcfo\b|\bcoo\b|founder|owner|partner|\bvp\b|vice president|head of/.test(t)) return "executive";
  if (/director/.test(t)) return "lead";
  if (/principal|staff/.test(t)) return "staff";
  if (/senior|sr\.?\s|lead\b/.test(t)) return "senior";
  if (/intern|junior|entry|assistant|graduate|trainee/.test(t)) return "junior";
  return "mid";
}

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "into", "your", "you", "our", "off", "cycle", "group", "full", "time", "intern", "summer", "senior", "junior", "lead", "head", "of", "at", "in", "on", "to", "a", "an", "inc", "ltd", "llc", "co", "team", "member", "associate", "assistant", "manager", "director", "analyst", "consultant", "specialist", "officer", "executive", "school", "university", "college", "business", "institute", "bachelor", "master", "degree", "honours", "honors", "diploma", "certificate", "certification", "london", "delhi", "india", "york", "level", "national"]);

// Pull meaningful keywords from profile text (positions, headline, degrees) so
// even a profile with no explicit skills section still matches on real terms.
function deriveKeywords(text) {
  return [...new Set(
    (text.toLowerCase().match(/[a-z][a-z+.#-]{2,}/g) || [])
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  )];
}

// Lightweight discipline classifier that also covers finance/legal/etc.
function classifyDisciplineExt(text) {
  const t = (text || "").toLowerCase();
  if (/financ|valuation|invest|equity|banking|m&a|audit|\btax\b|accounting|advisory|cfa\b|hedge|portfolio|trading|treasury/.test(t)) return "finance";
  if (/legal|litigation|attorney|paralegal|counsel|compliance|contract/.test(t)) return "legal";
  if (/consult|strategy|operations|program manager|project manager/.test(t)) return "consulting";
  return classifyDiscipline(t, []);
}

async function readProfileViaUnipile(linkedinUrl) {
  const identifier = identifierFromUrl(linkedinUrl);
  if (!identifier) throw new Error("no identifier");
  const acct = await unipileAccountId();
  if (!acct) throw new Error("no connected LinkedIn account");
  // linkedin_sections=* pulls experience/education/skills (not in the base card,
  // especially for out-of-network profiles).
  const u = await unipileApi(`/api/v1/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(acct)}&linkedin_sections=*`, 28000);

  const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || null;
  if (!name) throw new Error("unipile: no profile");

  const work = Array.isArray(u.work_experience) ? u.work_experience : [];
  const edu = Array.isArray(u.education) ? u.education : [];
  const certs = Array.isArray(u.certifications) ? u.certifications : [];
  // Current role = the one with no end date (LinkedIn), else the first listed.
  const current = work.find((w) => !w.end) || work[0] || {};
  const title = u.headline || current.position || "Professional";
  const company = current.company || current.company_name || null;

  const posText = work.map((w) => `${w.position || ""} ${w.company || ""}`).join(" ");
  const eduText = edu.map((e) => `${e.degree || ""} ${e.school || ""}`).join(" ");
  const certText = certs.map((c) => c.name || "").join(" ");
  const text = `${u.headline || ""} ${u.summary || ""} ${posText} ${eduText} ${certText}`;

  // Skills: explicit if present, else vocab matches (whole-word, so "go" doesn't
  // match "government"), else derived keywords.
  const lc = text.toLowerCase();
  const hasTerm = (s) => new RegExp(`(^|[^a-z])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(lc);
  let skills = Array.isArray(u.skills) ? u.skills.map((s) => (typeof s === "string" ? s : s.name || "")).filter(Boolean) : [];
  if (!skills.length) skills = SKILL_VOCAB.filter(hasTerm);
  if (!skills.length) skills = deriveKeywords(text);
  skills = [...new Set(skills.map((s) => String(s).toLowerCase()))].slice(0, 16);

  const roles = [...new Set([u.headline, ...work.map((w) => w.position)].filter(Boolean))].slice(0, 5);
  const discipline = classifyDisciplineExt(text);

  return {
    name,
    title,
    company,
    seniority: inferSeniority(`${current.position || ""} ${work.map((w) => w.position).join(" ")}`),
    discipline,
    orientation: "hybrid",
    skills: skills.length ? skills : null,
    topSkills: skills.slice(0, 6).length ? skills.slice(0, 6) : null,
    roles: roles.length ? roles : null,
    domains: edu[0]?.school ? [edu[0].school] : [],
    // A concise, accurate search term for the job scan (avoids the long headline).
    searchTerm: current.position || discipline || "analyst",
    summary: `I'm ${current.position ? `${/^[aeiou]/i.test(current.position) ? "an" : "a"} ${current.position}${company ? ` at ${company}` : ""}` : title}.`,
    found: true,
  };
}

// Primary entry: read the real profile via Unipile; fall back to an estimate.
// Caches successful reads briefly to avoid repeat LinkedIn views (teaser+unlock).
export async function inferProfile(linkedinUrl, { refresh = false } = {}) {
  const handle = handleFromUrl(linkedinUrl) || "this candidate";
  if (unipileOn()) {
    const cacheKey = `prowl:scout:uprofile:v2:${identifierFromUrl(linkedinUrl) || handle}`;
    try {
      if (!refresh) {
        const cached = await kvGet(cacheKey).catch(() => null);
        if (cached?.profile && Date.now() - (cached.at || 0) < 30 * 60 * 1000) return cached.profile;
      }
    } catch { /* ignore */ }
    try {
      const p = await readProfileViaUnipile(linkedinUrl);
      if (p?.name) {
        const prof = normalizeProfile(p, { handle, source: "linkedin" });
        kvSet(cacheKey, { profile: prof, at: Date.now() }).catch(() => {});
        return prof;
      }
    } catch (e) {
      console.error("scout: Unipile read failed:", e.message);
    }
  }
  return inferProfileFallback(linkedinUrl);
}

// Fallback profile when the real read isn't available or didn't find the person:
// a Claude estimate from the URL, else the demo profile.
export async function inferProfileFallback(linkedinUrl) {
  const handle = handleFromUrl(linkedinUrl) || "this candidate";
  if (hasAI()) {
    try {
      const p = await claudeJSON(
        "You infer a plausible professional profile for a job-matching engine from a LinkedIn handle. You are estimating — be reasonable, not certain.",
        `From this LinkedIn profile URL, infer the most likely professional profile. The slug often hints at their name. Return JSON with keys: name, title, seniority (junior|mid|senior|staff|lead|executive), discipline, orientation (product|services|hybrid), skills (max 16 lowercase), topSkills (max 6 lowercase), roles (max 5 titles), domains, summary (1 first-person sentence starting with "I").

LinkedIn URL: ${linkedinUrl}
Handle: ${handle}`
      );
      return normalizeProfile(p, { handle, source: "ai" });
    } catch (e) {
      console.error("scout: AI inference failed:", e.message);
    }
  }
  return normalizeProfile({}, { handle, source: "demo" });
}

// ---- Jobs: fresh pool + 48h window ------------------------------------------
function hoursAgo(postedAt) {
  if (!postedAt) return Infinity;
  const t = new Date(postedAt).getTime();
  if (isNaN(t)) return Infinity;
  return (Date.now() - t) / 36e5;
}

// Pull a live, keyless batch fast, weighted toward the person's field, plus the
// cron pool. Two targeted Remotive searches (field query + their own role) bring
// in-field roles into the candidate set instead of relying on the tech-heavy pool.
async function gatherJobs(profile) {
  const fieldQuery = DISCIPLINE_QUERY[profile.discipline] || "software engineer";
  const roleQuery = profile.searchTerm || (profile.roles && profile.roles[0]) || profile.title || fieldQuery;
  const [pool, remotiveField, remotiveRole, adzuna, arbeitnow, remoteok] = await Promise.all([
    getJobPool().catch(() => ({ jobs: [] })),
    fetchRemotive(fieldQuery).catch(() => []),
    roleQuery.toLowerCase() !== fieldQuery.toLowerCase() ? fetchRemotive(roleQuery).catch(() => []) : Promise.resolve([]),
    // Adzuna = general, all-sector, query-based (finance/legal/etc.) — no-ops without keys.
    fetchAdzuna(fieldQuery).catch(() => []),
    fetchArbeitnow(3).catch(() => []),
    fetchRemoteOK().catch(() => []),
  ]);

  const merged = [...remotiveField, ...remotiveRole, ...adzuna, ...arbeitnow, ...remoteok, ...(pool.jobs || [])];
  // De-dupe by sourceId (fallback to title+company).
  const seen = new Set();
  const jobs = [];
  for (const j of merged) {
    const key = j.sourceId || `${j.title}|${j.company}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(j);
  }

  if (jobs.length === 0) {
    const { SEED_JOBS } = await import("@/lib/seed");
    return SEED_JOBS;
  }
  return jobs;
}

// Given a resolved profile, gather jobs, rank, and shape the report.
export async function buildReport(linkedinUrl, profile, { windowHours = 48, limit = 3 } = {}) {
  const allJobs = await gatherJobs(profile);

  const fresh = allJobs
    .map((j) => ({ ...j, ageHours: hoursAgo(j.postedAt) }))
    .filter((j) => j.ageHours <= windowHours);

  // Rank the fresh set; if too few clear the freshness bar (common with demo
  // pools), relax to the newest jobs so the report is never empty — and flag it.
  let pool = fresh;
  let relaxed = false;
  if (fresh.length < limit) {
    relaxed = true;
    pool = allJobs
      .map((j) => ({ ...j, ageHours: hoursAgo(j.postedAt) }))
      .sort((a, b) => a.ageHours - b.ageHours);
  }

  // Quality gate: a real match needs actual overlap with the person's field —
  // at least one skill/domain hit AND a meaningful score. This filters out
  // cross-domain roles that only matched a generic title word like "analyst".
  const scored = rankJobs(profile, pool, 0);
  const MIN_SCORE = 45;
  const strong = scored.filter((m) => m.matchedSkills.length >= 1 && m.score >= MIN_SCORE);
  // Show only genuinely relevant matches; if none clear the bar, return the best
  // near-misses (capped at 2) rather than a full page of weak results.
  const ranked = (strong.length ? strong : scored.filter((m) => m.matchedSkills.length >= 1).slice(0, 2)).slice(0, limit);

  const matches = ranked.map((m) => ({
    score: m.score,
    matchedSkills: m.matchedSkills,
    reasons: m.reasons,
    title: m.job.title,
    company: m.job.company,
    location: m.job.location,
    remote: m.job.remote,
    url: m.job.url,
    salary: m.job.salary,
    ageHours: Math.round(m.job.ageHours),
    postedAt: m.job.postedAt,
  }));

  return {
    profile: {
      name: profile.name,
      title: profile.title,
      seniority: profile.seniority,
      discipline: profile.discipline,
      company: profile.company || null,
      topSkills: profile.topSkills,
      summary: profile.summary,
      inferred: !!profile.inferred,
      source: profile.source || "demo",
      handle: profile.handle || handleFromUrl(linkedinUrl),
    },
    windowHours,
    freshCount: fresh.length,
    totalScanned: allJobs.length,
    relaxed,
    matches,
  };
}

// Synchronous path (used when Parallel isn't available): estimate the profile
// then build the report in one call.
export async function scout(linkedinUrl, opts = {}) {
  const profile = await inferProfileFallback(linkedinUrl);
  return buildReport(linkedinUrl, profile, opts);
}

// ---- Lead capture ------------------------------------------------------------
const LEADS_INDEX = "prowl:scout:leads";

export async function saveScoutLead({ email, linkedinUrl, profile, matches }) {
  const clean = String(email).toLowerCase().trim();
  const lead = {
    email: clean,
    linkedinUrl,
    name: profile?.name || null,
    title: profile?.title || null,
    topMatch: matches?.[0] ? { company: matches[0].company, title: matches[0].title, score: matches[0].score } : null,
    matchCount: matches?.length || 0,
    at: new Date().toISOString(),
  };
  await kvSet(`prowl:scout:lead:${clean}`, lead);
  const index = (await kvGet(LEADS_INDEX)) || [];
  if (!index.includes(clean)) {
    index.push(clean);
    await kvSet(LEADS_INDEX, index);
  }
  return lead;
}

export async function getScoutLeads() {
  const index = (await kvGet(LEADS_INDEX)) || [];
  return index;
}
