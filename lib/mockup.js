// AI mockup image for the pitch video's "what I'd do for you" scene.
//
// Uses CLAUDE (not a diffusion model): Claude designs a clean, on-brand SVG
// mockup, and we rasterize it to PNG with resvg. Diffusion models mangle text
// and fake UIs; Claude-authored SVG stays crisp, legible, and deterministic,
// and it reuses the Anthropic key we already have (no OpenAI needed).

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { Resvg } from "@resvg/resvg-js";
import { hasAI } from "./ai.js";

const MODEL = "claude-sonnet-4-5";
export const mockupEnabled = () => hasAI();

// Vendored Inter TTFs (lib/fonts), bundled with the function so text renders
// even though serverless hosts ship no system fonts.
let FONTS = null;
function fonts() {
  if (FONTS) return FONTS;
  const dir = path.join(process.cwd(), "lib", "fonts");
  FONTS = ["Inter-Regular.ttf", "Inter-SemiBold.ttf", "Inter-Bold.ttf"]
    .map((f) => { try { return fs.readFileSync(path.join(dir, f)); } catch { return null; } })
    .filter(Boolean);
  return FONTS;
}

function disciplineBrief(discipline) {
  switch (discipline) {
    case "design": return "a redesigned product UI screen: a top nav bar showing the product area, 3-4 labeled content cards or a left sidebar, and ONE highlighted primary button. Each element labeled to show the improvement";
    case "marketing": return "a campaign concept board: a bold labeled hero message, 3 channel tiles (each named with a channel + the tactic), and one small labeled metric callout";
    case "engineering": return "a labeled architecture/flow diagram: 3-4 named boxes connected by arrows (e.g. Client, API, Test Suite, Deploy), each box clearly labeled, with a one-line caption of what it improves";
    case "security": return "a security-posture dashboard: a posture score with a label, plus a checklist of 3-4 NAMED hardening items each with a status label";
    case "data": return "an analytics dashboard: 3 KPI tiles (each with a named metric + value) and one simple labeled bar chart";
    default: return "a concept board: a titled header and 3-4 labeled cards that spell out the plan";
  }
}

function extractSvg(text) {
  const m = (text || "").match(/<svg[\s\S]*<\/svg>/i);
  return m ? m[0] : null;
}

export async function generateMockupImage({ brief, idea, discipline = "product", company = "the company" }) {
  if (!hasAI()) return null;
  const ideaLine = idea?.title ? `${idea.title}: ${idea.detail || ""}`.trim() : (brief || `a high-impact improvement for ${company}`);
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: "You output pixel-clean SVG mockups. Output ONLY a single self-contained <svg> element. No prose, no code fences.",
      messages: [{
        role: "user",
        content: `Design ${disciplineBrief(discipline)} for a pitch to ${company}.
It must clearly and visually communicate THIS specific idea:
"${ideaLine}"

Hard requirements:
- One <svg> element, width="1280" height="720", viewBox="0 0 1280 720".
- Background #0A0E0D, mint accent #34E5A3, text #FFFFFF and #9AA6A1 for secondary.
- font-family="Inter" on every <text>; font-size >= 20 for labels, >= 34 for the title.
- Put a clear TITLE at the top that names the improvement (from the idea). Add a small caption mentioning ${company}.
- Include 3-5 labeled elements (cards, steps, tiles, or a flow) that concretely represent the idea. CRITICAL: NO empty or blank boxes. EVERY box/row/tile MUST contain a short, real, correctly-spelled label (2-5 words) tied to the idea. A viewer must understand the concept from the labels alone.
- Vector shapes only (rect, circle, line, path, text, polygon). NO <image>, <foreignObject>, <script>, external URLs, external-id gradients, or real company logos.
- LAYOUT: a clear title bar across the top, then an aligned grid or flow of the labeled elements below it. Consistent card sizes, generous even spacing (>=48px between elements, >=56px slide margins), strong visual hierarchy. Balanced composition. No large empty areas, no overcrowding, no floating decorative shapes.
- SPELLING: every word must be real and correctly spelled. Double-check. This is customer-facing.
- Make it look like a real ${discipline} mockup a designer/PM would present. Informative, not decorative. Someone glancing at it must understand the idea from the labels in 3 seconds.
Return only the SVG.`,
      }],
    });
    const svg = extractSvg(msg.content?.[0]?.text);
    if (!svg) return null;
    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: 1280 },
      background: "#0A0E0D",
      font: { loadSystemFonts: false, fontBuffers: fonts(), defaultFontFamily: "Inter" },
    });
    return Buffer.from(r.render().asPng());
  } catch (e) {
    console.warn("generateMockupImage (Claude SVG) failed, skipping mockup scene:", e.message);
    return null;
  }
}
