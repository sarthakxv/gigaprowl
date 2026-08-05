import { ImageResponse } from "next/og";

// Public route: renders a branded 16:9 slide PNG used as a background scene in
// the Loom-style pitch video. HeyGen fetches these by URL, so it must be public.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const INK = "#0A0E0D";
const PANEL = "#121A17";
const MINT = "#34E5A3";
const FOG = "#9AA6A1";

const clip = (s, n) => (s || "").toString().slice(0, n);
// Truncate at a WORD boundary (never mid-word) with an ellipsis if cut.
const wclip = (s, n) => {
  const t = (s || "").toString().replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const c = t.slice(0, n);
  const sp = c.lastIndexOf(" ");
  return (sp > 10 ? c.slice(0, sp) : c).replace(/[\s,.;:—-]+$/, "") + "…";
};

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const kind = p.get("kind") || "title";
  const company = clip(p.get("company"), 40) || "the team";
  const domain = clip(p.get("domain"), 48);
  const name = clip(p.get("name"), 40);
  const role = wclip(p.get("role"), 52);
  const heading = wclip(p.get("heading"), 80);
  const bullets = (p.get("bullets") || "").split("|").map((b) => wclip(b, 88)).filter(Boolean).slice(0, 3);
  const angle = wclip(p.get("angle"), 86);
  const ideas = (p.get("ideas") || "").split("|").map((chunk) => {
    const [t, d] = chunk.split("~");
    return { title: wclip(t, 42), detail: clip(d, 120) };
  }).filter((x) => x.title).slice(0, 3);
  const monogram = (company.trim()[0] || "•").toUpperCase();

  const Frame = (children) => (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: INK, color: "#fff", padding: 72, fontFamily: "sans-serif", justifyContent: "center" }}>
      {children}
    </div>
  );

  let body;
  if (kind === "ideas") {
    body = Frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", color: MINT, fontSize: 25, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
          What I'd do for {company}
        </div>
        {angle ? <div style={{ display: "flex", fontSize: 40, fontWeight: 800, lineHeight: 1.15, maxWidth: 1096 }}>{angle}</div> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {ideas.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, maxWidth: 1096 }}>
              <div style={{ width: 13, height: 13, borderRadius: 13, background: MINT, display: "flex", flexShrink: 0 }} />
              <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#E9EFEC" }}>{it.title}</div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (kind === "value") {
    body = Frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", color: MINT, fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
          How I'd add value
        </div>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 800, lineHeight: 1.1, maxWidth: 1040 }}>{heading || `Impact at ${company}`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, maxWidth: 1080 }}>
              <div style={{ width: 13, height: 13, borderRadius: 13, background: MINT, marginTop: 11, display: "flex", flexShrink: 0 }} />
              <div style={{ display: "flex", fontSize: 27, color: "#E9EFEC", lineHeight: 1.35 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // title
    body = Frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 108, height: 108, borderRadius: 108, background: PANEL, border: `3px solid ${MINT}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 800, color: MINT }}>
            {monogram}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{company}</div>
            {domain ? <div style={{ display: "flex", fontSize: 26, color: FOG }}>{domain}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", color: MINT, fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
          Prepared for {company}
        </div>
        <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.05, maxWidth: 820 }}>
          {"Why I'm the right fit"}
        </div>
        {role ? <div style={{ display: "flex", fontSize: 30, color: "#E9EFEC" }}>{role}</div> : null}
      </div>
    );
  }

  return new ImageResponse(body, { width: 1280, height: 720 });
}
