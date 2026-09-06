// Runtime unslop: same job as the /unslop skill, for generated user-facing copy.
// Mechanical strip always runs. When ANTHROPIC_API_KEY is set, a second Claude
// pass rewrites leftover AI tells. Fails open to the stripped original.

export const UNSLOP_RULES = `Rewrite like a specific person typing, not a model.
Hard rules:
- No em dashes, en dashes, or hyphen-as-dash. Periods or commas only. No parentheses used as dash substitutes.
- No AI vocabulary: additionally, crucial, delve, enhance, leverage, utilize, foster, showcase, pivotal, robust, seamless, streamline, unlock, empower, landscape (abstract), tapestry, testament, underscore, vibrant, facilitate.
- No puffery: excited to, passionate about, add value, hands-on depth, aligned perfectly, resonates with, I'm particularly drawn, game-changer, cutting-edge, production-grade (unless you name the production thing), deep expertise, thrive where.
- No "not just X, but Y" / "isn't X, it's Y". State the point.
- No chatbot closers: I'd love to compare notes, I hope this helps, let me know if, Would you have 15 minutes to discuss.
- No mid-sentence colons used as connectors. A colon before a list is fine.
- No rule-of-three padding. Use the natural number of facts.
- Active voice. Specific facts. Vary sentence length. First person when the copy is the candidate speaking.
- If a line is generic filler ("hands-on depth", "add value", "senior-level professional with ~N years across skills"), replace it with a specific resume-backed line.
Keep every fact, name, number, URL, and {{placeholder}}. Same JSON keys and array lengths.`;

const PHRASES = [
  [/I bring hands-on depth in ([^\n.]+(?:\.[a-z0-9]+)*)/gi, "I used $1 in production"],
  [/hands-on depth in ([^\n.]+(?:\.[a-z0-9]+)*)/gi, "Used $1 in production"],
  [/here's how I'd add value fast/gi, "I can start on the work"],
  [/how I'd add value(?: to your team)?/gi, "how I'd help"],
  [/I'd add value/gi, "I'd help"],
  [/\badd value\b/gi, "help"],
  [/I'm particularly drawn to/gi, "I want to work on"],
  [/aligns? perfectly with/gi, "matches"],
  [/aligns? exactly with/gi, "matches"],
  [/align well with/gi, "fit"],
  [/resonates with/gi, "fits"],
  [/I'd love to compare notes/gi, "tell me how you handle this"],
  [/Would you have 15 minutes(?: this week)? to discuss[^.?]*\?/gi, "Worth 15 minutes this week?"],
  [/Would you have 15 minutes to discuss[^.?]*\?/gi, "Worth 15 minutes?"],
];

export function stripSlop(text) {
  if (typeof text !== "string" || !text) return text;
  let s = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ");
  // List items that start with a dash. Drop the dash, keep the line.
  s = s.replace(/(^|\n)\s*[\u2014\u2013]\s*/g, "$1");
  // Unicode dashes: sentence break if the next word is capitalized, else a comma.
  s = s.replace(/\s*[\u2014\u2013]\s*(?=[A-Z])/g, ". ");
  s = s.replace(/\s*[\u2014\u2013]\s*/g, ", ");
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  s = s.replace(/:\.\s+/g, ": ");
  return s;
}

export function stripSlopDeep(value) {
  if (typeof value === "string") return stripSlop(value);
  if (Array.isArray(value)) return value.map(stripSlopDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripSlopDeep(v);
    return out;
  }
  return value;
}

function takeStrings(original, rewritten) {
  if (typeof original === "string") {
    return typeof rewritten === "string" && rewritten.length ? rewritten : original;
  }
  if (Array.isArray(original)) {
    return original.map((item, i) => takeStrings(item, Array.isArray(rewritten) ? rewritten[i] : undefined));
  }
  if (original && typeof original === "object") {
    const out = {};
    for (const k of Object.keys(original)) out[k] = takeStrings(original[k], rewritten?.[k]);
    return out;
  }
  return original;
}

export async function unslopJSON(value, { resumeExcerpt = "", maxTokens = 2500 } = {}) {
  const filler = /hands-on depth|add value|senior-level professional/.test(JSON.stringify(value).toLowerCase());
  const stripped = stripSlopDeep(value);
  const { hasAI, claudeJSON } = await import("./ai.js");
  if (!hasAI()) return stripped;
  try {
    const resume = resumeExcerpt
      ? `\nRESUME (source of truth. Drop or soften any claim not supported here):\n${resumeExcerpt}\n`
      : "";
    const force = filler
      ? "\nThis JSON is generic filler. Rewrite EVERY string from the resume into specific copy. Do not keep 'hands-on depth', 'add value', or 'senior-level professional' lines.\n"
      : "\nBanned phrases that still appear MUST be rewritten, not lightly edited. Scan once more before you return.\n";
    const out = await claudeJSON(
      "You edit generated job-search copy. Remove AI writing tells. Preserve facts, not wording. Return ONLY the same JSON shape.",
      `${UNSLOP_RULES}
${force}
${resume}
JSON:
${JSON.stringify(stripped)}`,
      maxTokens
    );
    if (!out || typeof out !== "object") return stripped;
    let merged = stripSlopDeep(takeStrings(stripped, out));
    const stillFiller = filler && /senior-level professional|hands-on depth|\badd value\b/.test(JSON.stringify(merged).toLowerCase());
    if (stillFiller && resumeExcerpt) {
      const retry = await claudeJSON(
        "Rewrite this JSON from the resume into specific candidate copy. Same keys. No filler.",
        `The copy below is generic fallback. Replace every string with specific resume-backed copy.\n${UNSLOP_RULES}\n\nRESUME:\n${resumeExcerpt}\n\nJSON:\n${JSON.stringify(merged)}`,
        maxTokens
      );
      if (retry && typeof retry === "object") merged = stripSlopDeep(takeStrings(merged, retry));
    }
    return merged;
  } catch {
    return stripped;
  }
}
