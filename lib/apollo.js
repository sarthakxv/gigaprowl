// Contact discovery via Apollo.io. Finds likely hiring managers for a role at a company.
//
// Uses People API Search (`mixed_people/api_search`) — NOT `mixed_people/search`.
// The latter returns 403 on most plans even with a valid, credited API key.
// Search returns no emails/phones; we enrich top hits via `people/match`.
import { findEmail, verifyEmail, leadmagicEnabled } from "@/lib/leadmagic";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

function apolloHeaders(key) {
  return { "Content-Type": "application/json", "X-Api-Key": key };
}

// Fill missing emails via LeadMagic (and verify the ones we already have) so the
// Gmail outreach step has a deliverable target. Runs in parallel, best-effort.
async function enrichEmails(contacts, job) {
  if (!leadmagicEnabled() || !contacts?.length) return contacts;
  const domain = job.companyDomain || null;
  return Promise.all(
    contacts.map(async (c) => {
      try {
        if (!c.email) {
          const hit = await findEmail({ firstName: c.firstName, lastName: c.lastName, company: c.company, domain });
          if (hit?.email) return { ...c, email: hit.email, emailStatus: hit.status, emailSource: "leadmagic" };
        } else {
          const v = await verifyEmail(c.email);
          if (v) return { ...c, emailStatus: v.status };
        }
      } catch {}
      return c;
    })
  );
}

function managerTitlesFor(jobTitle) {
  const t = jobTitle.toLowerCase();
  if (/data|ml|machine learning|ai/.test(t)) return ["Head of Data", "Director of Data Science", "VP of AI", "Engineering Manager"];
  if (/product manager|product owner/.test(t)) return ["VP of Product", "Head of Product", "Director of Product"];
  if (/design/.test(t)) return ["Head of Design", "Design Director", "VP of Design"];
  if (/devops|sre|infra|platform/.test(t)) return ["Head of Infrastructure", "Director of Platform Engineering", "VP of Engineering"];
  if (/security/.test(t)) return ["CISO", "Head of Security", "Director of Security Engineering"];
  return ["Engineering Manager", "Director of Engineering", "VP of Engineering", "Head of Engineering", "CTO"];
}

function demoContacts(job, titles, note) {
  return titles.slice(0, 2).map((title, i) => ({
    id: `demo_${job.sourceId}_${i}`,
    firstName: ["Alex", "Jordan"][i], lastName: ["Rivera", "Chen"][i],
    name: ["Alex Rivera", "Jordan Chen"][i], title,
    company: job.company, email: null, linkedinUrl: null,
    confidence: note,
  }));
}

function mapPerson(p, job) {
  const lastName = p.last_name || null;
  const email = p.email && p.email !== "email_not_unlocked@domain.com" ? p.email : null;
  return {
    id: p.id,
    firstName: p.first_name,
    lastName,
    name: p.name || [p.first_name, lastName].filter(Boolean).join(" "),
    title: p.title,
    company: p.organization?.name || job.company,
    email,
    linkedinUrl: p.linkedin_url || null,
    confidence: "apollo",
  };
}

async function enrichPerson(key, id) {
  const res = await fetch(`${APOLLO_BASE}/people/match`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    console.error(`Apollo people/match ${res.status}`);
    return null;
  }
  const data = await res.json();
  return data.person || null;
}

async function apolloErrorNote(res) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body.error || body.message || body.error_code || "";
  } catch {}
  const hint = res.status === 403
    ? " — use a Master API key with People API Search access (Settings → Integrations → API)"
    : "";
  return `demo — Apollo key returned ${res.status}${detail ? `: ${String(detail).slice(0, 120)}` : hint}`;
}

// One People API Search call. `titles` and/or `seniorities` may be omitted
// (Pass 1 is title-based, Pass 2 is seniority-based). Returns people on
// success so callers can tell "zero hits" apart from an HTTP failure.
async function searchPeople(key, job, { titles, seniorities, perPage }) {
  const body = { page: 1, per_page: perPage };
  if (titles?.length) {
    body.person_titles = titles;
    body.include_similar_titles = true;
  }
  if (seniorities?.length) body.person_seniorities = seniorities;
  if (job.companyDomain) {
    body.q_organization_domains_list = [job.companyDomain.replace(/^www\./, "")];
  } else if (job.company) {
    body.q_keywords = job.company;
  }
  const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, res };
  const data = await res.json();
  return { ok: true, people: data.people || [] };
}

const SENIORITY_WIDEN = ["manager", "head", "director", "vp", "c_suite", "founder", "owner"];

const TITLE_STOPWORDS = new Set(["of", "and"]);
const COMPANY_WEAK_TOKENS = new Set(["of", "and", "the", "inc", "llc", "ltd", "corp", "co", "gmbh", "ai", "io", "unknown"]);
const DOMAIN_TLDS = new Set(["com", "io", "ai", "net", "org", "co"]);
const TITLE_ALIASES = {
  cto: ["chief", "technology", "officer"],
  ciso: ["chief", "information", "security", "officer"],
  vp: ["vice", "president"],
};

function tokenize(text) {
  return (text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function titleTokenSet(text) {
  return new Set(tokenize(text));
}

function seedTitleTokens(titles) {
  return [...new Set(tokenize(titles.join(" ")).filter((t) => !TITLE_STOPWORDS.has(t)))];
}

function seedTokenAliasMatches(hitTokens, token) {
  if (hitTokens.has(token)) return false;
  const aliases = TITLE_ALIASES[token];
  if (!aliases) return false;
  if (aliases.filter((a) => hitTokens.has(a)).length < 2) return false;
  if (token === "cto") return hitTokens.has("technology");
  if (token === "ciso") return hitTokens.has("security") || hitTokens.has("information");
  return true;
}

function seedTokenMatches(hitTokens, token) {
  return hitTokens.has(token) || seedTokenAliasMatches(hitTokens, token);
}

function companyTokens(company) {
  return tokenize(company).filter((t) => !COMPANY_WEAK_TOKENS.has(t));
}

function domainFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url.includes("://") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainTokens(domain) {
  return tokenize(domain).filter((t) => !DOMAIN_TLDS.has(t));
}

// Pass 2 only: reject hits whose org name/domain doesn't overlap the target company.
function sameCompany(hit, job) {
  const org = hit.organization || {};
  const companyTokenSet = new Set(companyTokens(job.company));
  if (!companyTokenSet.size) return false;

  const orgNameTokens = companyTokens(org.name || "");
  if (orgNameTokens.some((t) => companyTokenSet.has(t))) return true;

  const orgDomain = (org.primary_domain || domainFromUrl(org.website_url) || "")
    .replace(/^www\./, "")
    .toLowerCase();

  if (orgDomain) {
    const orgDomainTokenSet = new Set(domainTokens(orgDomain));
    if ([...companyTokenSet].some((t) => orgDomainTokenSet.has(t))) return true;
  }

  return false;
}

// Cheap relevance for the widened pass: family keywords mirror the branches in
// managerTitlesFor so a platform job prefers "Head of Platform" over a random
// sales director at the same company.
function familyKeywordsFor(jobTitle) {
  const t = jobTitle.toLowerCase();
  if (/data|ml|machine learning|ai/.test(t)) return ["data", "machine learning", "ml", "ai", "engineering"];
  if (/product manager|product owner/.test(t)) return ["product"];
  if (/design/.test(t)) return ["design", "ux", "ui"];
  if (/devops|sre|infra|platform/.test(t)) return ["platform", "infrastructure", "infra", "devops", "sre", "engineering"];
  if (/security/.test(t)) return ["security", "infosec"];
  return ["engineering", "software", "development", "tech"];
}

// +2 per whole-word seed-title token, +1 per family keyword in the hit title.
// Zero-score hits are kept as tail candidates — some senior contact beats
// a demo fallback. Equal scores prefer alias-expanded acronym matches; Apollo
// order breaks remaining ties (stable sort).
function rankByRelevance(hits, titles, job) {
  const seedTokens = seedTitleTokens(titles);
  const keywords = familyKeywordsFor(job.title);
  return hits
    .map((hit) => {
      const hitTokens = titleTokenSet(hit.title);
      let score = 0;
      let aliasHits = 0;
      for (const token of seedTokens) {
        if (seedTokenAliasMatches(hitTokens, token)) aliasHits += 1;
        if (seedTokenMatches(hitTokens, token)) score += 2;
      }
      for (const kw of keywords) {
        if (kw.includes(" ")) {
          if ((hit.title || "").toLowerCase().includes(kw)) score += 1;
        } else if (hitTokens.has(kw)) {
          score += 1;
        }
      }
      return { hit, score, aliasHits };
    })
    .sort((a, b) => b.score - a.score || b.aliasHits - a.aliasHits)
    .map(({ hit }) => hit);
}

export async function findContacts(job) {
  const key = process.env.APOLLO_API_KEY;
  const titles = managerTitlesFor(job.title);

  if (!key) return enrichEmails(demoContacts(job, titles, "demo — add APOLLO_API_KEY for real contacts"), job);

  // Pass 1: preferred manager titles, with Apollo's similar-title matching on.
  const pass1 = await searchPeople(key, job, { titles, perPage: 5 });
  if (!pass1.ok) {
    console.error(`Apollo ${pass1.res.status} — falling back to demo contacts`);
    return enrichEmails(demoContacts(job, titles, await apolloErrorNote(pass1.res)), job);
  }

  let hits = pass1.people;

  // Pass 2: widen to seniority-only search when exact/similar titles miss.
  // Better to show some senior contact at the company than a demo list.
  if (!hits.length) {
    const pass2 = await searchPeople(key, job, { seniorities: SENIORITY_WIDEN, perPage: 10 });
    if (pass2.ok && pass2.people.length) {
      const matched = pass2.people.filter((hit) => sameCompany(hit, job));
      if (matched.length) hits = rankByRelevance(matched, titles, job);
    }
  }

  if (!hits.length) {
    return enrichEmails(demoContacts(job, titles, "demo — Apollo found no contacts at this company"), job);
  }

  // Search omits emails/LinkedIn and may obfuscate last names — enrich top hits.
  const enriched = [];
  for (const hit of hits.slice(0, 3)) {
    const full = hit.id ? await enrichPerson(key, hit.id) : null;
    if (!full?.first_name || !full?.last_name) continue;
    enriched.push(mapPerson(full, job));
  }

  return enriched.length
    ? enrichEmails(enriched, job)
    : enrichEmails(demoContacts(job, titles, "demo — Apollo found contacts but enrichment returned no usable profiles"), job);
}
