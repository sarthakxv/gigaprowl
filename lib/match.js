// Matching engine: profile ↔ job scoring.

const PRODUCT_COMPANIES = new Set(["stripe","figma","airtable","databricks","gitlab","cloudflare","anthropic","notion","vercel","rippling","brex","plaid","netflix","palantir"].map((s) => s.toLowerCase()));
const SERVICE_HINTS = /consult|agency|solutions|services|outsourc|staffing|systems integrat/i;

export function companyOrientation(job) {
  const c = (job.company || "").toLowerCase();
  if (PRODUCT_COMPANIES.has(c)) return "product";
  if (SERVICE_HINTS.test(job.company + " " + (job.description || "").slice(0, 500))) return "services";
  return "product"; // most tech job boards skew product
}

const SENIORITY_RANK = { junior: 0, mid: 1, senior: 2, staff: 3, lead: 4, executive: 5 };

function jobSeniority(title) {
  const t = title.toLowerCase();
  if (/intern|junior|entry/.test(t)) return 0;
  if (/staff|principal/.test(t)) return 3;
  if (/lead|head of/.test(t)) return 4;
  if (/director|vp|chief|cto|ceo/.test(t)) return 5;
  if (/senior|sr\.?/.test(t)) return 2;
  return 1;
}

export function scoreJob(profile, job) {
  const text = (job.title + " " + (job.description || "") + " " + (job.tags || []).join(" ")).toLowerCase();

  // Skills overlap (0-50)
  const hits = profile.skills.filter((s) => text.includes(s.toLowerCase()));
  const topHits = profile.topSkills.filter((s) => text.includes(s.toLowerCase()));
  const skillScore = Math.min(50, hits.length * 5 + topHits.length * 5);

  // Role title relevance (0-20)
  const roleScore = profile.roles.some((r) =>
    job.title.toLowerCase().includes(r.toLowerCase().replace(/senior |staff |lead /g, ""))
  ) ? 20 : profile.roles.some((r) => r.toLowerCase().split(" ").some((w) => w.length > 3 && job.title.toLowerCase().includes(w))) ? 10 : 0;

  // Seniority alignment (0-15)
  const diff = Math.abs(SENIORITY_RANK[profile.seniority] - jobSeniority(job.title));
  const seniorityScore = Math.max(0, 15 - diff * 6);

  // Orientation fit (0-15)
  const jobOrient = companyOrientation(job);
  const orientScore = profile.orientation === "hybrid" ? 10 : profile.orientation === jobOrient ? 15 : 4;

  const score = Math.round(skillScore + roleScore + seniorityScore + orientScore);
  return {
    score,
    scoreBreakdown: { skillScore, roleScore, seniorityScore, orientScore },
    matchedSkills: hits.slice(0, 8),
    orientationFit: jobOrient,
    reasons: [
      hits.length ? `${hits.length} skill overlap${hits.length > 1 ? "s" : ""}: ${hits.slice(0, 4).join(", ")}` : "Low direct skill overlap",
      seniorityScore >= 9 ? "Seniority aligned" : "Seniority stretch",
      `${jobOrient}-oriented company`,
    ],
  };
}

// A paid, personalized video needs stronger evidence than a feed match. This
// prevents a high aggregate score from hiding a role, seniority, or skill gap.
export function videoEligibility(profile, job) {
  const match = scoreJob(profile, job);
  const b = match.scoreBreakdown;
  const reasons = [];
  if (match.score < 75) reasons.push("overall match score is below 75");
  if (b.skillScore < 20 || match.matchedSkills.length < 2) reasons.push("not enough direct skill overlap");
  if (b.roleScore < 10) reasons.push("target role does not align with the candidate's roles");
  if (b.seniorityScore < 9) reasons.push("seniority gap is too large");
  if (b.orientScore < 10) reasons.push("company orientation is a poor fit");
  return { eligible: reasons.length === 0, reasons, match };
}

// minScore raised to 50: below this the fit is too weak to surface or pitch,
// which was producing "wrong fit" outreach. Full pitched hunts still require ≥75
// via videoEligibility(); this just keeps weak matches out of the feed entirely.
export function rankJobs(profile, jobs, minScore = 50) {
  return jobs
    .map((job) => ({ job, ...scoreJob(profile, job) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
