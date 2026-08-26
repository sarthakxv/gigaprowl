"use client";

import { useState } from "react";
import Link from "next/link";

const SCANNING_LINES = [
  "reading your profile…",
  "scanning 400+ company boards…",
  "filtering to the last 48 hours…",
  "scoring every opening against you…",
  "ranking your best-fit matches…",
];

function ScoreRing({ score }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, score) / 100);
  const color = score >= 75 ? "#3DFFA2" : score >= 55 ? "#2BCB80" : "#9DB4AC";
  return (
    <div className="relative shrink-0" style={{ width: 68, height: 68 }}>
      <svg width="68" height="68" className="-rotate-90">
        <circle cx="34" cy="34" r={r} stroke="#1E2A27" strokeWidth="6" fill="none" />
        <circle cx="34" cy="34" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-lg" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export default function Scout() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | scanning | teaser | unlocked
  const [scanLine, setScanLine] = useState(0);
  const [teaser, setTeaser] = useState(null);
  const [report, setReport] = useState(null);
  const [err, setErr] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [runId, setRunId] = useState(null);

  async function postScout(payload) {
    const r = await fetch("/api/scout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Scan failed");
    return data;
  }

  async function runScan(e) {
    e?.preventDefault();
    setErr("");
    if (!/linkedin\.com\/in\//i.test(url)) {
      setErr("Paste a full LinkedIn profile URL — e.g. linkedin.com/in/your-name");
      return;
    }
    setPhase("scanning");
    setScanLine(0);
    const timer = setInterval(() => setScanLine((i) => Math.min(i + 1, SCANNING_LINES.length - 1)), 2600);
    try {
      // Start the run, then poll until the real read completes (up to ~2.5 min).
      let data = await postScout({ linkedinUrl: url });
      let rid = data.runId || null;
      setRunId(rid);
      let tries = 0;
      while (data.status === "running" && tries < 50) {
        await new Promise((res) => setTimeout(res, 3000));
        tries++;
        data = await postScout({ linkedinUrl: url, runId: rid });
        if (data.runId) { rid = data.runId; setRunId(rid); }
      }
      if (data.status !== "done") throw new Error("This is taking longer than expected — please try again.");
      setReport(data);
      setPhase("unlocked");
    } catch (e2) {
      setErr(e2.message);
      setPhase("idle");
    } finally {
      clearInterval(timer);
    }
  }

  async function unlock(e) {
    e?.preventDefault();
    setErr("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErr("Enter a valid email to unlock your report.");
      return;
    }
    setUnlocking(true);
    try {
      const data = await postScout({ linkedinUrl: url, runId, email });
      if (data.status !== "done") throw new Error("Couldn't save — please try again.");
      setReport(data);
      setEmailSaved(true);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setUnlocking(false);
    }
  }

  function reset() {
    setPhase("idle");
    setTeaser(null);
    setReport(null);
    setEmail("");
    setEmailSaved(false);
    setErr("");
  }

  return (
    <div className="min-h-screen bg-ink overflow-hidden">
      {/* glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, #3DFFA2 0%, transparent 70%)" }} />

      <nav className="relative max-w-5xl mx-auto flex items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-2xl font-bold">gigaprowl<span className="text-mint">.</span></Link>
        <span className="text-sm text-fog">scout <span className="text-mint">·</span> free 48-hour job scan</span>
      </nav>

      <main className="relative max-w-3xl mx-auto px-6 pb-24">
        {/* ---------------- IDLE ---------------- */}
        {phase === "idle" && (
          <header className="text-center pt-10">
            <p className="inline-block bg-panel border border-edge rounded-full px-4 py-1.5 text-sm text-fog mb-8">🎯 open to work? let's find who's hiring right now.</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
              paste your linkedin.<br />
              <span className="text-mint">get matched in 60 seconds.</span>
            </h1>
            <p className="text-fog text-lg max-w-xl mx-auto mb-10">
              we scan hundreds of company boards for roles posted in the <span className="text-white">last 48 hours</span>, score every one against your profile, and hand you the 3 worth applying to today.
            </p>

            <form onSubmit={runScan} className="max-w-xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="linkedin.com/in/your-name"
                  className="flex-1 bg-panel border border-edge focus:border-mint outline-none rounded-full px-6 py-4 text-white placeholder-fog/50 transition"
                />
                <button type="submit" className="bg-mint text-ink font-bold px-8 py-4 rounded-full hover:bg-mintdim hover:scale-105 transition whitespace-nowrap">
                  scan for me →
                </button>
              </div>
              {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
              <p className="text-fog/50 text-sm mt-4">free · no signup · instant results</p>
            </form>
          </header>
        )}

        {/* ---------------- SCANNING ---------------- */}
        {phase === "scanning" && (
          <div className="pt-24 text-center">
            <div className="inline-block w-14 h-14 border-4 border-edge border-t-mint rounded-full animate-spin mb-8" />
            <p className="font-display text-2xl font-bold mb-2">on the gigaprowl.</p>
            <p className="text-mint text-lg h-7 transition-all">{SCANNING_LINES[scanLine]}</p>
            <p className="text-fog/50 text-sm mt-3">reading your actual profile — this takes up to a minute.</p>
          </div>
        )}

        {/* ---------------- TEASER (locked) ---------------- */}
        {phase === "teaser" && teaser && (
          <div className="pt-6">
            <ProfileCard p={teaser.profile} />

            <div className="flex items-baseline justify-between mt-8 mb-4">
              <h2 className="font-display text-2xl font-bold">
                {teaser.matchCount} match{teaser.matchCount === 1 ? "" : "es"} found
              </h2>
              <span className="text-fog text-sm">
                {teaser.relaxed ? "freshest openings" : `posted in the last ${teaser.windowHours}h`} · {teaser.totalScanned} scanned
              </span>
            </div>

            <div className="space-y-3">
              {teaser.matches.map((m, i) => (
                <div key={i} className="relative bg-panel border border-edge rounded-2xl p-5 overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 w-[68px] h-[68px] rounded-full border-2 border-edge flex items-center justify-center">
                      <span className="text-mint/40 text-2xl">🔒</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-lg truncate">{m.title}</p>
                      <p className="text-fog select-none blur-[5px]">{m.companyMasked}</p>
                      <p className="text-fog/70 text-sm mt-1">
                        {m.remote ? "🌍 remote" : m.location || "—"} · posted {m.ageHours <= 1 ? "just now" : `${m.ageHours}h ago`}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold bg-mint/10 text-mint border border-mint/30 rounded-full px-3 py-1">{m.scoreBand} fit</span>
                  </div>
                </div>
              ))}
            </div>

            {/* email gate */}
            <div className="mt-8 bg-panel border border-mint rounded-3xl p-8 text-center shadow-[0_0_80px_-30px_#3DFFA2]">
              <p className="text-2xl mb-2">🔓</p>
              <h3 className="font-display text-2xl font-bold mb-2">unlock your full match report</h3>
              <p className="text-fog mb-6 max-w-md mx-auto">
                see the exact companies, your match score for each, why you fit, and the direct apply link — free.
              </p>
              <form onSubmit={unlock} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@email.com"
                  className="flex-1 bg-ink border border-edge focus:border-mint outline-none rounded-full px-6 py-4 text-white placeholder-fog/50 transition"
                />
                <button type="submit" disabled={unlocking} className="bg-mint text-ink font-bold px-8 py-4 rounded-full hover:bg-mintdim hover:scale-105 transition disabled:opacity-60 whitespace-nowrap">
                  {unlocking ? "unlocking…" : "unlock →"}
                </button>
              </form>
              {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
              <p className="text-fog/50 text-xs mt-4">we'll email your report + keep you posted on fresh matches. no spam.</p>
            </div>
          </div>
        )}

        {/* ---------------- UNLOCKED (full) ---------------- */}
        {phase === "unlocked" && report && (
          <div className="pt-6">
            <ProfileCard p={report.profile} />

            <div className="flex items-baseline justify-between mt-8 mb-4">
              <h2 className="font-display text-2xl font-bold">your top {report.matches.length} to apply to today</h2>
              <span className="text-fog text-sm">
                {report.relaxed ? "freshest openings" : `posted in the last ${report.windowHours}h`}
              </span>
            </div>

            <div className="space-y-3">
              {report.matches.map((m, i) => (
                <div key={i} className="bg-panel border border-edge hover:border-mint rounded-2xl p-5 transition">
                  <div className="flex items-center gap-4">
                    <ScoreRing score={m.score} />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-lg truncate">{m.title}</p>
                      <p className="text-mint font-semibold">{m.company}</p>
                      <p className="text-fog/70 text-sm mt-1">
                        {m.remote ? "🌍 remote" : m.location || "—"} · posted {m.ageHours <= 1 ? "just now" : `${m.ageHours}h ago`}
                        {m.salary ? ` · ${m.salary}` : ""}
                      </p>
                    </div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="shrink-0 bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition text-sm">
                        apply →
                      </a>
                    )}
                  </div>
                  {m.matchedSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {m.matchedSkills.map((s) => (
                        <span key={s} className="text-xs bg-mint/10 text-mint border border-mint/20 rounded-full px-2.5 py-1">{s}</span>
                      ))}
                    </div>
                  )}
                  {m.reasons?.length > 0 && (
                    <p className="text-fog text-sm mt-3">{m.reasons.join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>

            {/* optional, non-blocking email capture */}
            {!emailSaved ? (
              <div className="mt-8 bg-panel border border-edge rounded-3xl p-6">
                <p className="font-display font-bold mb-1 text-center">want these emailed to you + fresh matches as they drop?</p>
                <p className="text-fog text-sm text-center mb-4">optional — your report's already above.</p>
                <form onSubmit={unlock} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@email.com"
                    className="flex-1 bg-ink border border-edge focus:border-mint outline-none rounded-full px-6 py-3 text-white placeholder-fog/50 transition"
                  />
                  <button type="submit" disabled={unlocking} className="bg-mint text-ink font-bold px-7 py-3 rounded-full hover:bg-mintdim transition disabled:opacity-60 whitespace-nowrap">
                    {unlocking ? "saving…" : "email me →"}
                  </button>
                </form>
                {err && <p className="text-red-400 text-sm mt-3 text-center">{err}</p>}
              </div>
            ) : (
              <div className="mt-8 text-center text-mint">✓ done — we'll be in touch at {email}.</div>
            )}

            <div className="mt-6 bg-panel border border-edge rounded-3xl p-8 text-center">
              <h3 className="font-display text-2xl font-bold mb-2">want gigaprowl to actually do the outreach?</h3>
              <p className="text-fog mb-6 max-w-md mx-auto">
                the full product finds the hiring manager, builds a personal pitch page + video of you, and drafts the emails. this scan was just a taste.
              </p>
              <Link href="/" className="inline-block bg-mint text-ink font-bold px-8 py-4 rounded-full hover:bg-mintdim hover:scale-105 transition">
                see the full gigaprowl →
              </Link>
              <button onClick={reset} className="block mx-auto text-fog hover:text-white text-sm mt-4">scan another profile</button>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-edge py-8 text-center text-fog/50 text-sm">
        gigaprowl scout — the smartest job hunter in the world
      </footer>
    </div>
  );
}

function ProfileCard({ p }) {
  const badge =
    p.source === "linkedin"
      ? { text: "✓ read from your LinkedIn", cls: "text-mint border-mint/40" }
      : p.source === "ai"
      ? { text: "estimated by AI", cls: "text-fog/70 border-edge" }
      : { text: "sample profile", cls: "text-fog/70 border-edge" };
  return (
    <div className="bg-panel border border-edge rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl font-bold">{p.name}</p>
          <p className="text-mint">{p.title} · <span className="text-fog capitalize">{p.seniority}</span></p>
          {p.company && <p className="text-fog text-sm mt-0.5">{p.company}</p>}
        </div>
        <span className={`shrink-0 text-xs border rounded-full px-3 py-1 ${badge.cls}`}>{badge.text}</span>
      </div>
      {p.summary && <p className="text-fog mt-3 text-sm leading-relaxed">{p.summary}</p>}
      {p.topSkills?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {p.topSkills.map((s) => (
            <span key={s} className="text-xs bg-edge text-fog rounded-full px-2.5 py-1">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
