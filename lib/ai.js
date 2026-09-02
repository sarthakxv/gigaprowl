// Claude wrapper with graceful heuristic fallbacks when no key present.
import Anthropic from "@anthropic-ai/sdk";
import { unslopJSON, stripSlopDeep } from "./unslop.js";

const MODEL = "claude-sonnet-4-5";

export function hasAI() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function claudeJSON(system, user, maxTokens = 2000) {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: system + "\nRespond with ONLY valid JSON. No markdown fences.",
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content[0].text.trim().replace(/^```json?\n?|```$/g, "");
  return JSON.parse(text);
}

// ---------- Resume parsing ----------
const SKILL_BANK = [
  "javascript","typescript","react","next.js","node","python","go","rust","java","kotlin","swift",
  "aws","gcp","azure","kubernetes","docker","terraform","postgres","mysql","mongodb","redis","kafka",
  "machine learning","deep learning","pytorch","tensorflow","llm","nlp","computer vision","data engineering",
  "spark","airflow","sql","etl","product management","design","figma","devops","sre","security","blockchain",
  "solidity","ios","android","flutter","react native","graphql","rest","microservices","ci/cd","git",
  "c++","c#",".net","ruby","rails","php","laravel","django","flask","fastapi","vue","angular","svelte",
  "tailwind","html","css","sales","marketing","seo","growth","analytics","tableau","power bi","excel",
];

// Heuristic discipline classifier (keyless fallback). Order matters. Most
// specific (security) first.
export function classifyDiscipline(lowerText, skills = []) {
  const s = (skills || []).join(" ") + " " + (lowerText || "");
  if (/security|infosec|penetration|appsec|vulnerab|ciso|soc 2|owasp/.test(s)) return "security";
  if (/figma|sketch|ux|ui\/ux|product design|visual design|design system|prototyp|user research/.test(s)) return "design";
  if (/marketing|seo|growth|demand gen|content marketing|brand|social media|campaign|copywrit/.test(s)) return "marketing";
  if (/data scien|machine learning|deep learning|analytics|etl|data engineer|pytorch|tensorflow|sql\b/.test(s)) return "data";
  if (/product manager|product owner|roadmap|prd|go-to-market/.test(s)) return "product";
  if (/\bsales\b|account executive|sdr|quota|pipeline|crm/.test(s)) return "sales";
  if (/engineer|developer|react|node|python|golang|kubernetes|backend|frontend|full-?stack|devops|sre/.test(s)) return "engineering";
  return "other";
}

export async function parseResume(text) {
  if (hasAI()) {
    try {
      return await claudeJSON(
        "You analyze tech resumes for a job-matching platform.",
        `Analyze this resume and return JSON:
{
  "name": string, "email": string|null, "title": string,
  "yearsExperience": number,
  "seniority": "junior"|"mid"|"senior"|"staff"|"lead"|"executive",
  "discipline": "design"|"marketing"|"engineering"|"security"|"data"|"product"|"sales"|"other" (their primary craft),
  "skills": string[] (max 20, lowercase),
  "topSkills": string[] (max 6),
  "orientation": "product"|"services"|"hybrid",
  "orientationReason": string (1 sentence: why product-company vs services-company fit),
  "roles": string[] (job titles they'd match, max 5),
  "domains": string[] (industries/domains),
  "compBandUSD": {"min": number, "max": number},
  "summary": string (2 sentences, FIRST PERSON. Start with "I", punchy),
  "strengths": string[] (3 bullets, first person e.g. "I ship...")
}

RESUME:
${text.slice(0, 12000)}`
      );
    } catch (e) {
      console.error("AI parse failed, falling back:", e.message);
    }
  }
  // Heuristic fallback
  const lower = text.toLowerCase();
  const skills = SKILL_BANK.filter((s) => lower.includes(s)).slice(0, 20);
  const years = Math.max(...[...text.matchAll(/(\d{1,2})\+?\s*years?/gi)].map((m) => +m[1]), 2);
  const seniority = years >= 12 ? "lead" : years >= 8 ? "staff" : years >= 5 ? "senior" : years >= 2 ? "mid" : "junior";
  const productSignals = ["startup","saas","product","growth","mvp","launch","users","metrics","a/b"].filter((w) => lower.includes(w)).length;
  const serviceSignals = ["client","consulting","agency","deliverable","stakeholder","vendor","outsourc"].filter((w) => lower.includes(w)).length;
  const orientation = productSignals > serviceSignals + 1 ? "product" : serviceSignals > productSignals + 1 ? "services" : "hybrid";
  const discipline = classifyDiscipline(lower, skills);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const name = text.split("\n").map((l) => l.trim()).find((l) => l && l.length < 40 && !l.includes("@")) || "Candidate";
  return {
    name, email: emailMatch?.[0] || null,
    title: skills.includes("react") || skills.includes("javascript") ? "Software Engineer" : "Technology Professional",
    yearsExperience: years, seniority, skills, discipline,
    topSkills: skills.slice(0, 6), orientation,
    orientationReason: `Resume language leans ${orientation}.`,
    roles: ["Software Engineer", "Senior Engineer", "Full-Stack Developer"],
    domains: ["technology"],
    compBandUSD: { min: 60000 + years * 8000, max: 90000 + years * 14000 },
    summary: `I'm a ${seniority} ${discipline === "other" ? "professional" : discipline} with about ${years} years in ${skills.slice(0, 3).join(", ") || "software"}.`,
    strengths: skills.slice(0, 3).map((s) => `Used ${s} in production.`),
  };
}

// Shared grounding rules appended to every generation system prompt so all
// user-facing copy stays strictly factual against the actual resume text.
const FACT_RULES = `
Use ONLY facts present in the resume text. NEVER invent numbers, metrics, company names, titles, projects, degrees, or outcomes. If the resume lacks specifics, write qualitatively (e.g. 'led placement operations') rather than inventing specifics ('90+ interviews') unless that exact figure appears in the resume. When in doubt, leave it out.
Write like a person typing. No em dashes or en dashes. No 'add value', 'hands-on depth', 'excited to', 'passionate about', 'leverage', 'utilize', 'I'm particularly drawn', 'aligns perfectly', 'resonates with', 'I'd love to compare notes'. No 'not just X, but Y'.`;

function resumeBlock(profile) {
  return profile && profile.resumeExcerpt
    ? `\nSOURCE OF TRUTH (the user's actual resume):\n${profile.resumeExcerpt}\n`
    : "";
}

// ---------- Fact-check pass ----------
// One Claude call that audits generated content against the resume text and
// returns a rewrite with unsupported claims removed/softened. Fails open.
export async function factCheck(content, resumeExcerpt) {
  if (!hasAI() || !resumeExcerpt) return { ok: true, unsupported: [], rewritten: content };
  try {
    const out = await claudeJSON(
      "You are a strict fact-checker for job-search content. The RESUME is the only source of truth.",
      `List any claims in CONTENT not supported by RESUME. Return JSON {"ok":boolean,"unsupported":string[],"rewritten":string} where rewritten is the content with unsupported claims removed or softened to resume-supported language. Keep tone, structure, and any {{pitch_url}} placeholders intact.

RESUME:
${resumeExcerpt}

CONTENT:
${content}`,
      2000
    );
    if (typeof out.ok !== "boolean" || typeof out.rewritten !== "string") return { ok: true, unsupported: [], rewritten: content };
    return out;
  } catch {
    return { ok: true, unsupported: [], rewritten: content };
  }
}

// ---------- Cadence generation ----------
// `signal` is an optional hiring signal (see lib/signals.js) used as a specific,
// timely personalization hook so outreach never opens with a generic line.
// `style` selects the email voice:
//   "standard": Gigaprowl's polished pitch-page-led cadence (default)
//   "founder_direct": Backdoor / Ben-Lang style. A <130-word, buzzword-free
//                      cold email straight to the founder, 1-2 concrete wins,
//                      one specific low-friction ask. Best for early startups.
export async function generateCadence(profile, job, contact, signal = null, style = "standard") {
  const founder = style === "founder_direct";
  const hiring = signal && signal.hiring;
  const hook = hiring
    ? (signal.event ? `I noticed ${job.company} is scaling (${signal.event})` : `I noticed ${job.company} has a few open roles right now`)
    : `I saw ${job.company} is hiring a ${job.title}`;
  const hookLower = hook.charAt(0).toLowerCase() + hook.slice(1);
  const win = (profile.strengths || [])[0] || `I've shipped real work in ${(profile.topSkills || []).slice(0, 2).join(" and ")}`;

  const standardFallback = {
    steps: [
      { day: 1, channel: "linkedin_connect", subject: null, body: `Hi ${contact.firstName}, ${hookLower}, and the ${job.title} role stood out. I've built exactly this kind of thing (${profile.topSkills.slice(0, 2).join(", ")}). Would love to connect.` },
      { day: 2, channel: "email", subject: `${job.title} @ ${job.company}: a shortcut`, body: `Hi ${contact.firstName},\n\n${hook}, and the ${job.title} opening caught my eye. Quick pitch: ${profile.summary}\n\nI put together a 1-page breakdown, with a 30-second intro video: {{pitch_url}}\n\nWorth 15 minutes?\n\n${profile.name}` },
      { day: 5, channel: "email", subject: `Re: ${job.title} @ ${job.company}`, body: `Hi ${contact.firstName},\n\nFloating this back up. The page has a short video walking through my thinking on ${job.company}'s stack: {{pitch_url}}\n\n${profile.name}` },
      { day: 8, channel: "linkedin_inmail", subject: `Idea for your ${job.title} search`, body: `${contact.firstName}, one more nudge. Happy to do a paid trial project to prove fit. Details here: {{pitch_url}}` },
    ],
  };
  const founderFallback = {
    steps: [
      { day: 1, channel: "email", subject: `quick one: ${job.title} at ${job.company}`, body: `Hi ${contact.firstName},\n\n${hookLower}. I'd like to help you build it.\n\nTwo things that might be relevant:\n• ${win}\n• ${(profile.strengths || [])[1] || profile.summary}\n\nMore on a quick page (30s video): {{pitch_url}}\n\nWorth a 15-min chat next week?\n\n${profile.name}` },
      { day: 4, channel: "email", subject: `re: ${job.title} at ${job.company}`, body: `Hi ${contact.firstName}, floating this back up in case it got buried. Still happy to show how I'd help: {{pitch_url}}\n\n${profile.name}` },
      { day: 7, channel: "linkedin_connect", subject: null, body: `Hi ${contact.firstName}, emailed you about the ${job.title} role. ${win}. Would love to connect.` },
    ],
  };
  const fallback = founder ? founderFallback : standardFallback;
  if (!hasAI()) return stripSlopDeep(fallback);

  const system = founder
    ? `You write cold emails from a job candidate straight to a startup FOUNDER, in the style that actually gets replies (think 'get a job with cold email'). Hard rules:
- Under 130 words. Plain, human language. ZERO buzzwords, zero "I'm excited to", zero corporate tone. Read like a smart person typing fast.
- Structure: (1) one line who you are, (2) why you're reaching out. Reference a SPECIFIC concrete detail about the company (recent raise/launch/product from the job description or hiring signal), (3) 1-2 concrete accomplishments with REAL specifics from the resume (metrics, named projects), (4) one specific, low-friction ask ("worth a 15-min chat next week?").
- No fake flattery ("huge fan for years"). Be honest. Use {{pitch_url}} at most once as an optional "more here" link. The email must stand on its own without it.` + FACT_RULES
    : "You write concise, non-cringe candidate outreach cadences to hiring managers. Never lie or invent experience. Open every message with a SPECIFIC, personalized hook. Reference the hiring signal or a concrete detail from the job description, never a generic 'I came across your company'." + FACT_RULES;

  const user = founder
    ? `Write a 3-step founder-direct cadence: day 1 cold email (<130 words), day 4 short follow-up email (<50 words), day 7 LinkedIn connect note (<=280 chars). {{pitch_url}} = the candidate's optional 1-page pitch (has a 30s video). Every line specific to THIS founder + company.
Return JSON: {"steps":[{"day":n,"channel":"email"|"linkedin_connect","subject":string|null,"body":string}]}

CANDIDATE: ${JSON.stringify({ name: profile.name, title: profile.title, topSkills: profile.topSkills, summary: profile.summary, strengths: profile.strengths })}
JOB: ${JSON.stringify({ title: job.title, company: job.company, description: (job.description || "").slice(0, 1500) })}
CONTACT: ${JSON.stringify({ firstName: contact.firstName, title: contact.title })}
${resumeBlock(profile)}
HIRING_SIGNAL: ${signal ? JSON.stringify({ hiring: signal.hiring, openRoles: signal.openRoles, event: signal.event, summary: signal.summary }) : "none"}`
    : `Write a 4-step outreach cadence (day 1 LinkedIn connect note <=280 chars, day 2 email, day 5 follow-up email, day 8 LinkedIn InMail). Use {{pitch_url}} as placeholder for the candidate's personalized landing page (it contains a 30-second intro video). Every message must feel written for THIS person at THIS company. Lead with the hiring signal when one is present.
Return JSON: {"steps":[{"day":n,"channel":"linkedin_connect"|"email"|"linkedin_inmail","subject":string|null,"body":string}]}

CANDIDATE: ${JSON.stringify({ name: profile.name, title: profile.title, topSkills: profile.topSkills, summary: profile.summary, strengths: profile.strengths })}
JOB: ${JSON.stringify({ title: job.title, company: job.company, description: (job.description || "").slice(0, 1500) })}
CONTACT: ${JSON.stringify({ firstName: contact.firstName, title: contact.title })}
${resumeBlock(profile)}
HIRING_SIGNAL: ${signal ? JSON.stringify({ hiring: signal.hiring, openRoles: signal.openRoles, event: signal.event, summary: signal.summary }) : "none"}`;

  try {
    const out = await claudeJSON(system, user);
    const shaped = out && Array.isArray(out.steps) && out.steps.length ? out : fallback;
    const refined = await unslopJSON(shaped, { resumeExcerpt: profile.resumeExcerpt, maxTokens: 2500 });
    if (Array.isArray(refined.steps)) {
      refined.steps = refined.steps.map((st) => (
        st.channel === "linkedin_connect" || st.channel === "linkedin_inmail"
          ? { ...st, body: String(st.body || "").slice(0, 280) }
          : st
      ));
    }
    return refined;
  } catch { return stripSlopDeep(fallback); }
}

// ---------- Apply kit (lite hunts, 50–74 band) ----------
// Cheap single Claude call: resume bullets plus a short apply note.
// No video, no pitch page, costs the user 0 credits.
export async function generateApplyKit(profile, job) {
  const skills = (profile.topSkills || []).slice(0, 2).join(" and ") || "the stack on the resume";
  const fallback = {
    bullets: (profile.topSkills || []).slice(0, 3).map((s) => `Used ${s} in production.`),
    applyNote: `Hi. I saw the ${job.title} role at ${job.company}. ${profile.summary || "I've done the work on the resume."} Happy to talk through how it maps.`,
    fitNote: `${skills} show up in the resume. Read the JD and tighten the bullets before you apply.`,
  };
  if (!hasAI()) return stripSlopDeep(fallback);
  try {
    const out = await claudeJSON(
      "You write application-form copy a candidate can paste. First person, plain, specific. No em dashes. No 'hands-on depth', 'add value', 'excited to', 'passionate about', 'leverage', or 'utilize'. Resume bullets, not marketing." + FACT_RULES,
      `Return JSON: {"bullets":string[] (3-4 resume bullets restating REAL resume facts for THIS job, each <=28 words, start with a verb),"applyNote":string (60-90 words, a short note for an application text box, one specific JD detail, no cover-letter flourish),"fitNote":string (1 sentence to the candidate: the real overlap and the honest gap)}

CANDIDATE: ${JSON.stringify({ name: profile.name, title: profile.title, yearsExperience: profile.yearsExperience, topSkills: profile.topSkills, skills: profile.skills, summary: profile.summary, strengths: profile.strengths })}
JOB: ${JSON.stringify({ title: job.title, company: job.company, description: (job.description || "").slice(0, 1500) })}
${resumeBlock(profile)}`,
      1200
    );
    return await unslopJSON(out && Array.isArray(out.bullets) ? out : fallback, {
      resumeExcerpt: profile.resumeExcerpt,
      maxTokens: 1500,
    });
  } catch { return stripSlopDeep(fallback); }
}

// ---------- Social posts ("Signal Boost") ----------
// One Claude call per top-account hunt: a LinkedIn post + X thread that make
// the candidate discoverable by the target company. Indirect pitch, never
// "please hire me". Uses {{pitch_url}} placeholder; caller swaps in the
// tracked pitch-page link. Copy-to-clipboard only. The user posts it.
export async function generateSocialPosts(profile, job, pitch) {
  const fallback = {
    linkedinPost: `${profile.summary}\n\nI've been thinking about ${(job.title || "").toLowerCase()} work the way ${job.company} has to think about it. ${(profile.strengths || [])[0] || "I ship, then I iterate."}\n\nNotes and a short video: {{pitch_url}}\n\nIf you're working on the same problems, tell me how you're approaching them.`,
    twitterThread: [
      `the fastest way to get hired isn't 500 applications. it's doing the job in public before anyone asks you to. a short thread 🧵`,
      `${profile.summary}`.slice(0, 270),
      `right now the most interesting problems in my corner of the field look a lot like what ${job.company} is building. so i started working through them anyway.`,
      `${(profile.strengths || [])[0] || `my rule: ship something real every week`}`.slice(0, 270),
      `i put the pitch, the receipts, and a 30-second video on one page: {{pitch_url}}`,
      `if you're building ${(job.title || "this kind of role").toLowerCase()} work, or working in the same space, my DMs are open.`,
    ],
    postAngle: `Public proof-of-work aimed at ${job.company}'s feed. Shows the craft instead of asking for the job.`,
  };
  if (!hasAI()) return stripSlopDeep(fallback);
  try {
    const out = await claudeJSON(
      `You ghostwrite social posts for ${profile.name}, a job candidate. Hard rules:
- Use ONLY facts from the candidate profile. Never invent metrics, employers, or claims.
- Do NOT say the company is hiring, do NOT ask for a job, do NOT @-mention anyone. The post should make the candidate discoverable by people at the target company by demonstrating relevant craft. Indirect pitch.
- First person, human, zero cringe. No "I'm excited to share", no hashtag walls (max 2 hashtags total), no emoji spam.
- Mention the candidate's pitch page naturally using the literal placeholder {{pitch_url}} exactly once in the LinkedIn post and once in the thread.${FACT_RULES}`,
      `Return JSON: {"linkedinPost":string (150-250 words; personal story angle: hook → a concrete workflow/result from the candidate's real history that maps to what ${job.company} visibly needs per the job description → one earned insight → a specific ask like "if you're working on X, tell me how you handle Y"; name the company at most once or not at all),"twitterThread":string[] (4-6 tweets; first tweet is a hook that earns the thread; each tweet under 280 characters; last tweet includes {{pitch_url}}),"postAngle":string (1 line: why this post works for this target)}

CANDIDATE: ${JSON.stringify({ name: profile.name, title: profile.title, yearsExperience: profile.yearsExperience, topSkills: profile.topSkills, skills: profile.skills, summary: profile.summary, strengths: profile.strengths })}
JOB: ${JSON.stringify({ title: job.title, company: job.company, description: (job.description || "").slice(0, 1500) })}
PITCH_ANGLE: ${JSON.stringify(pitch ? { headline: pitch.headline, companyAngle: pitch.companyAngle } : null)}
${resumeBlock(profile)}`,
      1600
    );
    if (!out.linkedinPost || !Array.isArray(out.twitterThread) || !out.twitterThread.length) return stripSlopDeep(fallback);
    const refined = await unslopJSON({
      linkedinPost: out.linkedinPost,
      twitterThread: out.twitterThread,
      postAngle: out.postAngle || "",
    }, { resumeExcerpt: profile.resumeExcerpt, maxTokens: 2500 });
    refined.twitterThread = (refined.twitterThread || []).map((t) => String(t).slice(0, 280));
    return refined;
  } catch { return stripSlopDeep(fallback); }
}

// ---------- Pitch page content ----------
// `signal` (optional) lets the companyAngle reference timing ("as you scale…").
export async function generatePitch(profile, job, signal = null) {
  const fallback = {
    headline: `${job.title} at ${job.company}. Here's why I'd do it.`,
    subhead: profile.summary,
    valueProps: profile.strengths.map((s, i) => ({ title: profile.topSkills[i] || "Experience", detail: s })),
    companyAngle: `${job.company} is hiring a ${job.title}. I've shipped this kind of work, and I want to do it on your team.`,
    videoScript: `Hi, I'm ${profile.name}. I saw the ${job.title} role at ${job.company}. ${profile.yearsExperience} years in ${profile.topSkills.slice(0, 2).join(" and ")}. Worth a short call?`,
    cta: "Book 15 minutes",
    // Loom-style deck: one spoken line per scene (title → website → value slide).
    deck: {
      intro: `Hi, I'm ${profile.name}. I saw ${job.company}'s ${job.title} role and had to reach out.`,
      company: `${job.company} is the kind of team I want to help build.`,
      value: {
        heading: profile.topSkills[0] ? `${profile.topSkills[0]} that ships` : "What I would ship",
        bullets: (profile.strengths || []).slice(0, 3),
        say: `I've spent ${profile.yearsExperience} years on this kind of work. I can start on yours.`,
      },
    },
  };
  if (!hasAI()) return stripSlopDeep(fallback);
  try {
    const out = await claudeJSON(
      "You ARE the candidate, writing your own pitch page to a specific company and role. Write EVERYTHING in first person ('I', 'my', 'your team'). Never third person, never your own name in the third person. Truthful, specific, confident." + FACT_RULES,
      `Return JSON: {"headline":string (first person, a specific claim, not "Why I'm the right X"),"subhead":string (first person),"valueProps":[{"title":string,"detail":string (first person)}] (3 items),"companyAngle":string (2-3 first-person sentences on how MY skills map to your needs based on the job description),"videoScript":string (a very SHORT, punchy first-person video script, about 15 seconds when spoken aloud, MAX 35 words, conversational, ends with a light CTA),"cta":string,"deck":{"intro":string (FIRST-PERSON spoken line, the candidate introducing themselves, ~6s, MAX 20 words),"company":string (FIRST-PERSON spoken line naming one specific thing about THIS company, ~6s, MAX 22 words),"value":{"heading":string (on-slide title, MAX 6 words),"bullets":string[] (2-3 short on-slide phrases, MAX 8 words each),"say":string (FIRST-PERSON spoken value line, what I'd bring, ~8s, MAX 26 words)}}}
Every deck line and videoScript is spoken BY the candidate in first person, addressed to the hiring manager. Never third person, never advice.

CANDIDATE: ${JSON.stringify({ name: profile.name, title: profile.title, yearsExperience: profile.yearsExperience, topSkills: profile.topSkills, summary: profile.summary, strengths: profile.strengths, orientation: profile.orientation })}
JOB: ${JSON.stringify({ title: job.title, company: job.company, description: (job.description || "").slice(0, 2000) })}
HIRING_SIGNAL: ${signal ? JSON.stringify({ hiring: signal.hiring, openRoles: signal.openRoles, event: signal.event, summary: signal.summary }) : "none"}
${resumeBlock(profile)}`
    );
    return await unslopJSON(out && out.headline ? out : fallback, {
      resumeExcerpt: profile.resumeExcerpt,
      maxTokens: 3000,
    });
  } catch { return stripSlopDeep(fallback); }
}
