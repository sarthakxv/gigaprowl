// Deep, discipline-specific research on the target company, turned into a small
// set of concrete, personalized "here's what I'd do for you" ideas + a brief for
// an AI mockup image. Real web research via the Parallel Task API when keyed;
// graceful Claude/template fallback otherwise.
//
// SAFETY: for security-oriented candidates we ONLY produce constructive, public,
// best-practice observations. We never ask for, and must never surface,
// exploitable vulnerability details or steps to attack a real system.

import { hasAI, claudeJSON, classifyDiscipline } from "./ai.js";
import { unslopJSON, stripSlopDeep } from "./unslop.js";

const PARALLEL_KEY = process.env.PARALLEL_API_KEY;
const PARALLEL_BASE = "https://api.parallel.ai/v1";
const PROCESSOR = process.env.PARALLEL_RESEARCH_PROCESSOR || "core";
const TIMEOUT_MS = Number(process.env.PARALLEL_RESEARCH_TIMEOUT_MS || 28000);

// What to look at, per discipline. Security is intentionally constructive-only.
function lensFor(discipline) {
  switch (discipline) {
    case "design":
      return "their product's actual UI/UX and visual design (site, app screenshots, design system). Identify 2-3 SPECIFIC, concrete improvement opportunities a senior designer would spot (hierarchy, onboarding, conversion, accessibility, consistency).";
    case "marketing":
      return "their public marketing: website messaging, blog, LinkedIn and X/Twitter presence, positioning. Identify 2-3 SPECIFIC campaign or channel ideas that fit their audience and gaps.";
    case "security":
      return "their PUBLIC security posture ONLY (presence of security.txt, bug-bounty/responsible-disclosure program, published SOC2/ISO, general auth/best-practice signals). Provide 2-3 CONSTRUCTIVE, high-level hardening or program recommendations. Do NOT identify, probe, or describe any exploitable vulnerability, and do NOT include attack steps.";
    case "data":
      return "their product's data/ML surface and public data practices. Identify 2-3 concrete opportunities (analytics, personalization, ML features, data quality) that fit the role.";
    case "product":
      return "their product, positioning and likely roadmap gaps. Identify 2-3 concrete product opportunities or experiments that fit the role.";
    case "sales":
      return "their go-to-market, ICP and outbound motion signals. Identify 2-3 concrete GTM/sales ideas.";
    default:
      return "their product, website and job description. Identify 2-3 concrete, high-impact things this candidate could ship in their first 90 days.";
  }
}

async function runParallelResearch(input) {
  const createRes = await fetch(`${PARALLEL_BASE}/tasks/runs`, {
    method: "POST",
    headers: { "x-api-key": PARALLEL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      processor: PROCESSOR,
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: {
            type: "object",
            properties: {
              angle: { type: "string", description: "One punchy sentence spoken BY the candidate directly TO the company, first person. Use 'I' and 'your/you'. e.g. \"I'd tighten your onboarding to lift activation.\" NEVER third person, NEVER advice about the candidate." },
              ideas: {
                type: "array",
                description: "2-3 specific, researched things the candidate WOULD DO for this company, written as the candidate's own words to the hiring manager.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "First-person action label, max 6 words. e.g. \"Redesign your onboarding\"." },
                    detail: { type: "string", description: "1-2 sentences in FIRST PERSON: what I would do for YOUR product/team, specific to this company. Use 'I' and 'your'. Never 'the candidate should' or 'you should pitch'." },
                  },
                  required: ["title", "detail"],
                },
              },
              mockup_brief: { type: "string", description: "A vivid prompt for an image model to render a single on-brand visual of the improvement the candidate would ship (e.g. the redesigned screen, the campaign concept, the architecture). No real logos or copyrighted assets." },
            },
            required: ["angle", "ideas", "mockup_brief"],
            additionalProperties: false,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!createRes.ok) throw new Error(`research create ${createRes.status}`);
  const { run_id } = await createRes.json();
  if (!run_id) throw new Error("no run_id");
  const resultRes = await fetch(`${PARALLEL_BASE}/tasks/runs/${run_id}/result`, {
    headers: { "x-api-key": PARALLEL_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resultRes.ok) throw new Error(`research result ${resultRes.status}`);
  const data = await resultRes.json();
  const c = data?.output?.content;
  if (!c || !Array.isArray(c.ideas)) throw new Error("bad research payload");
  return {
    angle: c.angle || "",
    ideas: c.ideas.slice(0, 3),
    mockupBrief: c.mockup_brief || "",
    source: "parallel",
  };
}

// Claude-only fallback (no live web research). Still tied to this profile and JD.
async function claudeFallback(profile, job, discipline) {
  const template = () => ({
    angle: `I'd bring my ${(profile.topSkills || []).slice(0, 2).join(" and ")} straight to ${job.company}.`,
    ideas: (profile.strengths || []).slice(0, 3).map((s, i) => ({
      title: (profile.topSkills || [])[i] ? `Apply my ${(profile.topSkills)[i]}` : "Ship impact fast",
      detail: `I'd put my ${(profile.topSkills || [])[i] || "experience"} to work for ${job.company}. ${s}`,
    })),
    mockupBrief: `A clean, modern ${discipline} concept visual for ${job.company} in a dark, minimal, mint-accented style.`,
    source: "template",
  });
  if (!hasAI()) return stripSlopDeep(template());
  try {
    const out = await claudeJSON(
      `You ARE a ${discipline} candidate pitching a specific company. Write everything in FIRST PERSON, spoken directly to the hiring manager ("I", "your", "${job.company}"). Produce the candidate's actual pitch. NEVER advice about how the candidate should pitch, never third person. Be concrete and truthful. For security, give only constructive, public best-practice recommendations. Never exploit details.`,
      `Return JSON {"angle":string (first-person one-liner to the company),"ideas":[{"title":string (<=6 words, first-person action),"detail":string (1-2 first-person sentences: what I'd do for your team/product)}] (2-3),"mockup_brief":string (a vivid image-model prompt for one on-brand ${discipline} visual of the improvement I'd ship; no real logos)}.
CANDIDATE (this is me): ${JSON.stringify({ name: profile.name, discipline, topSkills: profile.topSkills, strengths: profile.strengths, summary: profile.summary })}
COMPANY I'M PITCHING: ${JSON.stringify({ title: job.title, company: job.company, description: (job.description || "").slice(0, 1500) })}`,
      1200
    );
    return { angle: out.angle || "", ideas: (out.ideas || []).slice(0, 3), mockupBrief: out.mockup_brief || "", source: "claude" };
  } catch {
    return template();
  }
}

export async function getRoleResearch(profile, job) {
  const discipline = profile.discipline || classifyDiscipline((job.description || "").toLowerCase(), profile.skills);
  let raw = null;
  if (PARALLEL_KEY) {
    try {
      const input = {
        company: job.company,
        role: job.title,
        candidate_discipline: discipline,
        candidate_skills: (profile.topSkills || []).join(", "),
        job_description: (job.description || "").slice(0, 1200),
        instruction: `You ARE this candidate, pitching ${job.company} directly. Research ${lensFor(discipline)} Then write every idea in the candidate's OWN first-person voice, addressed to ${job.company} ("I'd redesign your…", "I'd build you…"). The ACTUAL pitch, never advice about how the candidate should pitch, never third person. Tie every idea to ${job.company} and the ${job.title} role.`,
      };
      raw = await runParallelResearch(JSON.stringify(input));
    } catch (e) {
      console.warn("getRoleResearch: Parallel failed, using Claude fallback:", e.message);
    }
  }
  if (!raw) raw = await claudeFallback(profile, job, discipline);
  const copy = await unslopJSON(
    { angle: raw.angle || "", ideas: raw.ideas || [] },
    { resumeExcerpt: profile.resumeExcerpt, maxTokens: 1500 }
  );
  return { discipline, ...raw, angle: copy.angle, ideas: copy.ideas };
}
