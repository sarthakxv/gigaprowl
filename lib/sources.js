// Job ingestion — worldwide.
//
// Two families of sources, all fetched live:
//  1) Direct company ATS boards (Greenhouse, Lever, Ashby, SmartRecruiters) —
//     straight from each company's hiring page, keyless, high quality.
//  2) Aggregators (Remotive, Arbeitnow, RemoteOK, The Muse, Adzuna) — broad,
//     worldwide volume. All keyless except Adzuna.
//
// Every fetch degrades to [] on failure, so one bad source never breaks a scan.
import { guessCompanyDomain } from "@/lib/domain";

function clean(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim();
}

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, {
      ...opts,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GigaprowlBot/1.0)", Accept: "application/json", ...(opts.headers || {}) },
      next: { revalidate: 0 },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const cap = (s, n = 600) => (s || "").slice(0, n);

// ============================ Aggregators ============================

export async function fetchRemotive(query = "software") {
  const data = await safeFetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=100`);
  return (data?.jobs || []).map((j) => ({
    source: "remotive", sourceId: `remotive_${j.id}`,
    title: j.title, company: j.company_name, companyDomain: guessCompanyDomain(j.company_name),
    location: j.candidate_required_location || "Remote", remote: true,
    url: j.url, salary: j.salary || null, tags: j.tags || [],
    description: cap(clean(j.description)), postedAt: j.publication_date,
  }));
}

// Arbeitnow — large, EU-heavy, keyless, paginated.
export async function fetchArbeitnow(pages = 3) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const data = await safeFetch(`https://www.arbeitnow.com/api/job-board-api?page=${p}`);
    for (const j of data?.data || []) {
      out.push({
        source: "arbeitnow", sourceId: `arbeitnow_${j.slug}`,
        title: j.title, company: j.company_name, companyDomain: guessCompanyDomain(j.company_name),
        location: j.location || "—", remote: !!j.remote,
        url: j.url, salary: null, tags: j.tags || [],
        description: cap(clean(j.description)), postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
      });
    }
    if (!data?.data?.length) break;
  }
  return out;
}

// RemoteOK — keyless; first array element is a legal notice (skip it).
export async function fetchRemoteOK() {
  const data = await safeFetch("https://remoteok.com/api");
  if (!Array.isArray(data)) return [];
  return data.filter((j) => j && j.id && j.position).map((j) => ({
    source: "remoteok", sourceId: `remoteok_${j.id}`,
    title: j.position, company: j.company, companyDomain: guessCompanyDomain(j.company),
    location: j.location || "Remote", remote: true,
    url: j.url || j.apply_url, salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : null,
    tags: j.tags || [], description: cap(clean(j.description)), postedAt: j.date,
  }));
}

// The Muse — keyless, worldwide, paginated (~20/page).
export async function fetchTheMuse(pages = 3) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const data = await safeFetch(`https://www.themuse.com/api/public/jobs?page=${p}`);
    for (const j of data?.results || []) {
      out.push({
        source: "themuse", sourceId: `themuse_${j.id}`,
        title: j.name, company: j.company?.name, companyDomain: guessCompanyDomain(j.company?.name),
        location: j.locations?.[0]?.name || "—", remote: /remote/i.test(j.locations?.map((l) => l.name).join(" ") || ""),
        url: j.refs?.landing_page, salary: null,
        tags: (j.categories || []).map((c) => c.name), description: cap(clean(j.contents)), postedAt: j.publication_date,
      });
    }
    if (!data?.results?.length) break;
  }
  return out;
}

// Adzuna — worldwide aggregator, keyed. Sweeps multiple countries.
const ADZUNA_COUNTRIES = ["us", "gb", "in", "ca", "au", "de", "fr", "nl", "sg"];
export async function fetchAdzuna(query = "software engineer") {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY } = process.env;
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];
  const tasks = ADZUNA_COUNTRIES.map((c) =>
    safeFetch(`https://api.adzuna.com/v1/api/jobs/${c}/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=50&what=${encodeURIComponent(query)}&content-type=application/json`)
      .then((d) => (d?.results || []).map((j) => ({
        source: "adzuna", sourceId: `adzuna_${j.id}`,
        title: j.title, company: j.company?.display_name || "Unknown", companyDomain: guessCompanyDomain(j.company?.display_name),
        location: j.location?.display_name || "—", remote: /remote/i.test(j.title + (j.description || "")),
        url: j.redirect_url, salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k` : null,
        tags: [], description: cap(clean(j.description)), postedAt: j.created,
      })))
  );
  const results = await Promise.allSettled(tasks);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ============================ Company ATS boards ============================

export async function fetchGreenhouse(board) {
  const data = await safeFetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
  const co = board.charAt(0).toUpperCase() + board.slice(1);
  return (data?.jobs || []).map((j) => ({
    source: "greenhouse", sourceId: `gh_${board}_${j.id}`,
    title: j.title, company: co, companyDomain: guessCompanyDomain(co),
    location: j.location?.name || "—", remote: /remote/i.test(j.location?.name || ""),
    url: j.absolute_url, salary: null, tags: [],
    description: cap(clean(j.content)), postedAt: j.updated_at,
  }));
}

export async function fetchLever(board) {
  const data = await safeFetch(`https://api.lever.co/v0/postings/${board}?mode=json&limit=100`);
  const co = board.charAt(0).toUpperCase() + board.slice(1);
  return (Array.isArray(data) ? data : []).map((j) => ({
    source: "lever", sourceId: `lever_${board}_${j.id}`,
    title: j.text, company: co, companyDomain: guessCompanyDomain(co),
    location: j.categories?.location || "—", remote: /remote/i.test(j.categories?.location || ""),
    url: j.hostedUrl, salary: null, tags: [j.categories?.team, j.categories?.commitment].filter(Boolean),
    description: cap(clean(j.descriptionPlain || j.description)), postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
}

export async function fetchAshby(board) {
  const data = await safeFetch(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`);
  const co = board.charAt(0).toUpperCase() + board.slice(1);
  return (data?.jobs || []).map((j) => ({
    source: "ashby", sourceId: `ashby_${board}_${j.id}`,
    title: j.title, company: co, companyDomain: guessCompanyDomain(co),
    location: j.location || "—", remote: !!j.isRemote,
    url: j.jobUrl || j.applyUrl, salary: null, tags: [j.department, j.team].filter(Boolean),
    description: cap(clean(j.descriptionPlain || j.descriptionHtml)), postedAt: j.publishedAt,
  }));
}

export async function fetchSmartRecruiters(board) {
  const data = await safeFetch(`https://api.smartrecruiters.com/v1/companies/${board}/postings?limit=100`);
  const co = board.charAt(0).toUpperCase() + board.slice(1);
  return (data?.content || []).map((j) => ({
    source: "smartrecruiters", sourceId: `sr_${board}_${j.id}`,
    title: j.name, company: j.company?.name || co, companyDomain: guessCompanyDomain(j.company?.name || co),
    location: [j.location?.city, j.location?.country].filter(Boolean).join(", ") || "—", remote: !!j.location?.remote,
    url: `https://jobs.smartrecruiters.com/${board}/${j.id}`, salary: null,
    tags: [j.department?.label, j.function?.label].filter(Boolean),
    description: "", postedAt: j.releasedDate,
  }));
}

// ---- Curated company boards (wrong tokens simply yield nothing) ----
const GREENHOUSE_BOARDS = [
  "stripe", "figma", "airtable", "databricks", "gitlab", "cloudflare", "notion", "vercel", "rippling",
  "brex", "plaid", "robinhood", "coinbase", "dropbox", "twitch", "discord", "instacart", "doordash",
  "lyft", "pinterest", "reddit", "samsara", "benchling", "gusto", "asana", "coursera", "wealthfront",
  "affirm", "chime", "flexport", "checkr", "retool", "hashicorp", "confluent", "elastic", "datadog",
  "cockroachlabs", "temporal", "verkada", "anduril", "faire", "webflow", "airbnb", "dropbox", "grammarly",
  "sofi", "marqeta", "gemini", "snyk", "vimeo", "peloton", "warby", "sourcegraph",
];
const LEVER_BOARDS = ["netflix", "palantir", "attentive", "voleon", "kayak", "spotify", "nerdwallet", "revolut", "showpad", "sofi", "brex"];
const ASHBY_BOARDS = ["ramp", "openai", "linear", "notion", "runway", "mercury", "clipboardhealth", "posthog", "replit", "vanta", "cursor", "perplexityai", "modal", "browserbase", "supabase"];
const SMARTRECRUITERS_BOARDS = ["Visa", "Bosch", "Ubisoft", "Square", "McDonalds", "PublicisGroupe", "IKEA"];

const DEFAULT_QUERIES = ["software engineer", "product manager", "designer", "data scientist", "marketing", "security engineer"];

// Daily worldwide scan: sweep all sources in parallel, dedupe by sourceId.
export async function syncAllSources(queries = DEFAULT_QUERIES) {
  const tasks = [
    ...queries.map((q) => fetchRemotive(q)),
    ...queries.map((q) => fetchAdzuna(q)),
    fetchArbeitnow(3),
    fetchRemoteOK(),
    fetchTheMuse(3),
    ...GREENHOUSE_BOARDS.map((b) => fetchGreenhouse(b)),
    ...LEVER_BOARDS.map((b) => fetchLever(b)),
    ...ASHBY_BOARDS.map((b) => fetchAshby(b)),
    ...SMARTRECRUITERS_BOARDS.map((b) => fetchSmartRecruiters(b)),
  ];
  const results = await Promise.allSettled(tasks);
  const jobs = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const seen = new Set();
  return jobs.filter((j) => {
    if (!j.title || !j.sourceId || seen.has(j.sourceId)) return false;
    seen.add(j.sourceId);
    return true;
  });
}
