// Which Claude model handles which AI task, and what each call costs.
// Import from here instead of hardcoding model IDs in feature code.
//
// Two tiers:
//   fast   - mechanical work (extraction, rule-based rewrites). Haiku.
//   writer - user-facing copy where quality drives outcomes. Sonnet.
// Override a tier's model with ANTHROPIC_MODEL_FAST / ANTHROPIC_MODEL_WRITER.
// Overrides must be 5.5-generation models; the request params below are
// shaped for them (older Claude models reject `output_config` and `thinking`).

export const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5";
export const MODEL_WRITER = process.env.ANTHROPIC_MODEL_WRITER || "claude-sonnet-5-5";

// Every task that calls Claude. Add new call sites here so spend stays visible.
// The apply kit starts on the fast tier; set AI_APPLY_KIT_TIER=writer to move it
// back to Sonnet if resume bullets come back weaker than you want.
export const AI_TASK_TIERS = {
  parseResume: "fast",
  unslop: "fast",
  unslopRetry: "fast",
  scoutInfer: "fast",
  applyKit: process.env.AI_APPLY_KIT_TIER === "writer" ? "writer" : "fast",
  socialPosts: "writer",
  cadence: "writer",
  pitch: "writer",
  mockup: "writer",
};

const TIERS = {
  fast: { model: MODEL_FAST, effort: "low" },
  writer: { model: MODEL_WRITER, effort: "medium" },
};

// These calls are plain JSON generation with no tools, so extended thinking
// only adds billed output tokens and can eat max_tokens before the JSON is
// written. Haiku turns it off with "disabled"; Sonnet 5.5 rejects that value
// and uses "between_tools" instead.
function thinkingOff(model) {
  return /haiku/.test(model) ? { type: "disabled" } : { type: "between_tools" };
}

// Request params for a task: spread into client.messages.create().
export function aiTaskParams(task) {
  const tier = TIERS[AI_TASK_TIERS[task]] || TIERS.writer;
  return {
    model: tier.model,
    thinking: thinkingOff(tier.model),
    output_config: { effort: tier.effort },
  };
}

// USD per million tokens (Anthropic API list prices, checked 2026-10-06).
// Used only for the usage log; the invoice is the source of truth.
export const MODEL_PRICING_USD_PER_MTOK = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

export function estimateCostUSD(model, usage) {
  const price = MODEL_PRICING_USD_PER_MTOK[model];
  if (!price || !usage) return null;
  return (
    ((usage.input_tokens || 0) * price.input + (usage.output_tokens || 0) * price.output) / 1e6
  );
}

// One log line per Claude call: task, model, tokens, estimated cost.
// Grep "[ai-usage]" in the server log to total a hunt or a day.
export function logAiUsage(task, model, usage) {
  const inTok = usage?.input_tokens || 0;
  const outTok = usage?.output_tokens || 0;
  const cost = estimateCostUSD(model, usage);
  console.log(
    `[ai-usage] task=${task} model=${model} in=${inTok} out=${outTok} cost_usd=${cost == null ? "n/a" : cost.toFixed(6)}`
  );
}
