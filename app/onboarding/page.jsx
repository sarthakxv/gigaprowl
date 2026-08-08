"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const RESUME_ACCEPT = ".pdf,.doc,.docx,.rtf,.txt,.md";

const STEPS = ["Resume", "How it works", "Ready"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (r.status === 401) window.location.href = "/login";
    });
  }, []);

  async function uploadResume(file) {
    setBusy(true); setError(null);
    const fd = new FormData();
    if (file) fd.append("resume", file);
    else {
      if (profileUrl.trim()) fd.append("url", profileUrl.trim());
      if (pastedText.trim()) fd.append("text", pastedText.trim());
    }
    const r = await fetch("/api/resume", { method: "POST", body: fd });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) return setError(data.error || "Upload failed");
    setProfile(data.profile);
  }

  async function finish() {
    setBusy(true);
    // Kick off the first scan so the dashboard has matches waiting.
    fetch("/api/jobs/sync", { method: "POST" }).catch(() => {});
    setTimeout(() => router.replace("/dashboard"), 800);
  }

  return (
    <div className="min-h-screen bg-ink px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-bold">gigaprowl<span className="text-mint">.</span></Link>
          <button
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login?mode=login"); }}
            className="text-fog hover:text-white text-sm"
          >
            Sign out
          </button>
        </div>
        <div className="flex gap-2 my-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full ${i <= step ? "bg-mint" : "bg-edge"}`} />
              <p className={`text-xs mt-2 ${i <= step ? "text-mint" : "text-fog/50"}`}>{s}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">drop your resume ✨</h1>
            <p className="text-fog mb-8">this is the only required step — gigaprowl builds your entire hunt from it.</p>
            {!profile ? (
              <div>
                <div className="bg-panel border-2 border-mint rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-bold bg-mint text-ink rounded-full px-3 py-1">easiest</span>
                    <p className="font-display text-xl font-bold">import from linkedin — 2 taps</p>
                  </div>
                  <ol className="text-sm text-fog space-y-1 mb-5">
                    <li>1. open your LinkedIn profile</li>
                    <li>2. tap More → Save to PDF</li>
                    <li>3. drop the PDF below 👇</li>
                  </ol>
                  <label className="block border-2 border-dashed border-mint hover:bg-mint/5 rounded-2xl p-12 text-center cursor-pointer transition">
                    <input type="file" accept={RESUME_ACCEPT} className="hidden" onChange={(e) => e.target.files[0] && uploadResume(e.target.files[0])} />
                    <p className="text-mint font-bold text-lg">{busy ? "analyzing…" : "drop your PDF here or click to upload"}</p>
                    <p className="text-fog/60 text-xs mt-2">PDF, DOCX, or TXT</p>
                  </label>
                  <p className="text-fog/60 text-xs mt-3">we read your own profile PDF — nothing sketchy, no logins, no scraping 🔒</p>
                </div>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-edge" />
                  <p className="text-fog/50 text-xs uppercase tracking-widest">or upload a resume file</p>
                  <div className="flex-1 h-px bg-edge" />
                </div>
                <label className="block bg-panel border border-edge hover:border-mint rounded-2xl p-6 text-center cursor-pointer transition">
                  <input type="file" accept={RESUME_ACCEPT} className="hidden" onChange={(e) => e.target.files[0] && uploadResume(e.target.files[0])} />
                  <p className="font-semibold text-sm mb-1">{busy ? "analyzing…" : "📄 upload your resume"}</p>
                  <p className="text-fog/60 text-xs">PDF, DOC, DOCX, RTF, TXT, or Markdown</p>
                </label>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-edge" />
                  <p className="text-fog/50 text-xs uppercase tracking-widest">or paste your experience</p>
                  <div className="flex-1 h-px bg-edge" />
                </div>
                <div className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={4}
                    placeholder="paste your LinkedIn 'About' + experience, your resume text, or just describe what you do…"
                    className="w-full bg-ink border border-edge focus:border-mint rounded-xl p-4 text-sm text-fog placeholder-fog/40 outline-none resize-none transition"
                  />
                  <button
                    onClick={() => uploadResume(null)}
                    disabled={busy || !pastedText.trim()}
                    className="text-sm text-fog border border-edge hover:border-mint hover:text-mint px-6 py-2.5 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? "building…" : "build from text →"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-panel border border-edge rounded-2xl p-6">
                <p className="font-display text-xl font-bold mb-1">{profile.name}</p>
                <p className="text-fog text-sm mb-4">{profile.title} · {profile.yearsExperience} yrs · {profile.seniority}</p>
                <p className="text-sm mb-3"><span className="text-mint font-semibold capitalize">{profile.orientation}-oriented.</span> <span className="text-fog">{profile.orientationReason}</span></p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {profile.topSkills.map((s) => <span key={s} className="text-xs bg-edge rounded-full px-3 py-1 text-mint">{s}</span>)}
                </div>
                <button onClick={() => setStep(1)} className="bg-mint text-ink font-bold px-8 py-3 rounded-full hover:bg-mintdim transition">Looks right →</button>
                <p className="text-fog/60 text-xs mt-4">You can connect email and LinkedIn, add a photo, or record your voice later from the dashboard.</p>
              </div>
            )}
            {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">You stay in control</h1>
            <p className="text-fog mb-8">Gigaprowl finds the opportunities and prepares the work. Nothing is sent just because you finished onboarding.</p>
            <div className="space-y-3 mb-8">
              {[
                ["1", "Review your matches", "See why each role fits before generating anything."],
                ["2", "Choose where to hunt", "Generate a pitch page and outreach drafts only for matches you approve."],
                ["3", "Connect and send when ready", "Add email, LinkedIn, a face photo, or a voice recording later from the dashboard."],
              ].map(([n, title, detail]) => (
                <div key={n} className="bg-panel border border-edge rounded-2xl p-5 flex gap-4">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-mint text-ink font-bold flex items-center justify-center">{n}</span>
                  <div><p className="font-semibold">{title}</p><p className="text-fog text-sm mt-1">{detail}</p></div>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setStep(2); finish(); }} className="bg-mint text-ink font-bold px-8 py-3 rounded-full hover:bg-mintdim transition">Start matching →</button>
              <button onClick={() => setStep(0)} className="text-fog hover:text-white px-4 py-3">Back</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center py-20">
            <h1 className="font-display text-4xl font-bold mb-4">The hunt is on<span className="text-mint">.</span></h1>
            <p className="text-fog">Scanning job boards and matching companies to your profile…</p>
          </div>
        )}
      </div>
    </div>
  );
}
