"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import VoiceRecorder from "../onboarding/VoiceRecorder";

const TABS = ["Matches", "Apply kits", "Contacts", "Cadences", "Activity", "Pitch pages", "Social posts"];

// A cadence step's scheduled calendar date = cadence createdAt + step.day days.
function stepDate(cadence, step) {
  const d = new Date(new Date(cadence.createdAt).getTime() + (step.day || 0) * 86400000);
  return d;
}
function fmtDay(d) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

export default function Dashboard() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("Matches");
  const [syncing, setSyncing] = useState(false);
  const [hunting, setHunting] = useState(null); // matchId in flight
  const [autopilot, setAutopilot] = useState(null); // "running" | "done"
  const [uploadingMedia, setUploadingMedia] = useState(null); // "face" | "voice"
  const [mediaHidden, setMediaHidden] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/state");
    if (r.status === 401) { window.location.href = "/login?mode=login"; return; }
    setState(await r.json());
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  useEffect(() => { refresh(); }, [refresh]);

  // Social posts are generated lazily after a hunt (decoupled from it). For any
  // pitch that doesn't have its posts yet, fire /api/social one at a time, then refresh.
  const [socialRunning, setSocialRunning] = useState(false);
  useEffect(() => {
    if (!state || socialRunning) return;
    const posts = state.socialPosts || [];
    const pending = (state.pitches || []).filter(
      (p) => p.matchId && p.socialStatus !== "failed" && !posts.some((x) => x.matchId === p.matchId)
    );
    if (!pending.length) return;
    setSocialRunning(true);
    (async () => {
      for (const p of pending.slice(0, 5)) {
        try {
          await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: p.matchId }) });
        } catch {}
      }
      setSocialRunning(false);
      refresh();
    })();
  }, [state, socialRunning, refresh]);

  // Kits wait until the hunt finishes, same as social posts. Hunt already burns the 60s budget.
  // Also writes kits for jobs you hunted before this existed.
  const [kitRunning, setKitRunning] = useState(false);
  const kitAttemptedRef = useRef(new Set());
  useEffect(() => {
    if (!state || kitRunning) return;
    const kits = state.applyKits || [];
    const pending = (state.pitches || []).filter(
      (p) => p.matchId && !kits.some((x) => x.matchId === p.matchId) && !kitAttemptedRef.current.has(p.matchId)
    );
    if (!pending.length) return;
    const batch = pending.slice(0, 5);
    batch.forEach((p) => kitAttemptedRef.current.add(p.matchId));
    setKitRunning(true);
    (async () => {
      for (const p of batch) {
        try {
          await fetch("/api/apply-kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: p.matchId }) });
        } catch {}
      }
      setKitRunning(false);
      refresh();
    })();
  }, [state, kitRunning, refresh]);

  // Outreach generation is always explicit. "Automated" controls delivery of
  // already-generated cadence steps; it never starts creating outreach.
  async function runAutopilot(opts = {}) {
    if (!state || autopilot === "running") return;
    setAutopilot("running");
    try {
      await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liteOnly: !!opts.liteOnly }),
      });
    } catch {}
    setAutopilot("done");
    refresh();
  }

  async function makeApplyKit(matchId) {
    setHunting(matchId);
    const r = await fetch("/api/apply-kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId }) });
    const d = await r.json().catch(() => ({}));
    setHunting(null);
    if (r.ok) toast.success("Apply kit ready. Copy the bullets and note from Apply kits.");
    else toast.error(d.error || "Apply kit failed");
    if (r.ok) { kitAttemptedRef.current.add(matchId); setTab("Apply kits"); }
    refresh();
  }

  async function runSync() {
    setSyncing(true);
    const r = await fetch("/api/jobs/sync", { method: "POST" });
    const d = await r.json();
    setSyncing(false);
    if (r.ok) toast.success(`Scan complete: ${d.added} new · ${d.stored} in pool (${d.kb}KB)`);
    else toast.error(d.error || "Scan failed");
    refresh();
  }

  async function hunt(matchId) {
    setHunting(matchId);
    const r = await fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId }) });
    const d = await r.json();
    setHunting(null);
    if (r.ok) toast.success(`Outreach ready. Pitch page + ${d.cadenceSteps}-step cadence drafted (${d.unlimitedCredits ? "unlimited credits" : `${d.creditsLeft} credits left`})`);
    else toast.error(d.error || "Outreach failed");
    refresh();
  }

  async function uploadMedia(kind, file) {
    setMediaError(null);
    setUploadingMedia(kind);
    const fd = new FormData();
    fd.append("kind", kind); fd.append("file", file);
    let r;
    try { r = await fetch("/api/media", { method: "POST", body: fd }); }
    catch { setUploadingMedia(null); return setMediaError("Upload failed. Check your connection and retry."); }
    const data = await r.json().catch(() => ({}));
    setUploadingMedia(null);
    if (r.ok) { toast.success(kind === "voice" ? "Voice added. Your videos will use your cloned voice" : "Photo added. Avatar videos enabled"); refresh(); }
    else setMediaError(data.error || `${kind === "voice" ? "Voice" : "Photo"} upload failed.`);
  }

  async function updateResume(file) {
    setUploadingMedia("resume");
    const fd = new FormData();
    fd.append("resume", file);
    const r = await fetch("/api/resume", { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    setUploadingMedia(null);
    if (r.ok) toast.success("Résumé updated. Your profile and matches will refresh");
    else toast.error(data.error || "Résumé update failed");
    if (r.ok) refresh();
  }

  const [sending, setSending] = useState(null); // `${cadId}:${idx}` in flight

  // Surface connect outcomes redirected back in ?connect=…
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("connect");
    if (!p) return;
    const msg = {
      gmail_ok: "Gmail connected. Outreach will send from your address ✓",
      gmail_denied: "Gmail connection was cancelled.",
      gmail_unconfigured: "Gmail isn't configured yet (add GOOGLE_CLIENT_ID/SECRET).",
      gmail_no_refresh: "Google didn't return a refresh token. Remove Gigaprowl's access in your Google account, then reconnect.",
      gmail_error: "Gmail connection failed. Try again.",
      linkedin_ok: "LinkedIn connected ✓",
      linkedin_failed: "LinkedIn connection didn't complete.",
    }[p];
    if (msg) {
      if (p.endsWith("_ok")) toast.success(msg);
      else toast.error(msg);
    }
    window.history.replaceState({}, "", "/dashboard");
    if (p === "linkedin_ok") {
      // Reconcile immediately in case the provider callback arrived late.
      fetch("/api/connect/linkedin/sync", { method: "POST" })
        .then(() => refresh())
        .catch(() => refresh());
    } else {
      refresh();
    }
  }, [refresh]);

  function connectGmail() {
    if (!state?.integrations?.gmail) return toast.error("Gmail isn't configured yet (add GOOGLE_CLIENT_ID/SECRET in Vercel).");
    window.location.href = "/api/connect/google";
  }
  const [liPair, setLiPair] = useState(null); // { token, base }
  async function connectLinkedIn() {
    if (state?.integrations?.linkedinManaged) {
      const r = await fetch("/api/connect/linkedin");
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        window.location.href = d.url;
        return;
      }
      return toast.error(d.error || "Couldn't start LinkedIn connection.");
    }
    const r = await fetch("/api/li/pair");
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.token) setLiPair(d);
    else toast.error(d.error || "Couldn't generate a pairing token.");
  }

  async function sendStep(cad, idx) {
    const key = `${cad.id}:${idx}`;
    setSending(key);
    const r = await fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cadenceId: cad.id, stepIndex: idx }) });
    const d = await r.json().catch(() => ({}));
    setSending(null);
    const msg = d.drafted ? "Saved as a draft in your Gmail ✓" : d.queued ? "Queued for LinkedIn ✓" : `Sent via ${(d.channel || "channel").replace("_", " ")} ✓`;
    if (r.ok) toast.success(msg.replace(" ✓", ""));
    else toast.error(d.error || "Send failed");
    if (r.ok) refresh();
  }

  async function setMode(outreachMode) {
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outreachMode }) });
    if (r.ok) { toast.success(outreachMode === "manual" ? "Manual: emails saved as Gmail drafts to review" : "Automated: Gigaprowl sends emails for you"); refresh(); }
  }

  async function setEmailStyle(emailStyle) {
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailStyle }) });
    if (r.ok) { toast.success(emailStyle === "founder_direct" ? "New hunts will write short founder-direct emails" : "New hunts will use the standard pitch-led style"); refresh(); }
  }

  const [restyling, setRestyling] = useState(null);
  async function restyle(cadId, style) {
    setRestyling(cadId);
    const r = await fetch("/api/cadence/restyle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cadenceId: cadId, style }) });
    const d = await r.json().catch(() => ({}));
    setRestyling(null);
    if (r.ok) toast.success(`Rewritten in ${style === "founder_direct" ? "founder-direct" : "standard"} style`);
    else toast.error(d.error || "Rewrite failed");
    if (r.ok) refresh();
  }

  if (!state) return <div className="min-h-screen bg-ink flex items-center justify-center text-fog">Loading…</div>;
  if (!state.profile)
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-4 text-fog">
        <p>No profile yet.</p>
        <Link href="/onboarding" className="bg-mint text-ink font-bold px-8 py-3 rounded-full">Upload your resume</Link>
      </div>
    );

  const { profile, matches, contacts, cadences, pitches, credits, integrations, media } = state;
  const applyKits = state.applyKits || [];
  const socialPosts = state.socialPosts || [];
  const kitIds = new Set(applyKits.map((k) => k.matchId));
  const liteWithoutKit = (matches || []).filter((m) => m.score >= 50 && m.score < 75 && !kitIds.has(m.id));
  const scoreByMatchId = new Map((matches || []).map((m) => [m.id, m.score]));
  function kitScore(k) {
    const live = scoreByMatchId.get(k.matchId);
    if (typeof live === "number") return live;
    if (typeof k.score === "number") return k.score;
    return null;
  }

  return (
    <div className="min-h-screen bg-ink pb-20">
      <nav className="border-b border-edge">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-xl font-bold">gigaprowl<span className="text-mint">.</span></Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-fog">{credits.unlimited ? "Unlimited credits · Dev" : `${credits.balance} credits`}</span>
            <button onClick={runSync} disabled={syncing} title="Jobs auto-refresh daily; this scans on demand" className="bg-mint text-ink font-semibold px-4 py-2 rounded-full hover:bg-mintdim transition disabled:opacity-50">
              {syncing ? "Scanning…" : "Refresh jobs"}
            </button>
            <button onClick={logout} className="text-fog hover:text-white text-sm">Log out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-8">
        <div className="bg-panel border border-edge rounded-2xl p-6 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="font-display text-xl font-bold">{profile.name}</p>
            <p className="text-fog text-sm">{profile.title} · {profile.seniority} · <span className="text-mint capitalize">{profile.orientation}</span>-oriented</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.topSkills.map((s) => <span key={s} className="text-xs bg-edge rounded-full px-3 py-1 text-mint capitalize">{s}</span>)}
          </div>
          <label className="text-xs border border-edge hover:border-mint rounded-full px-3 py-1.5 text-fog hover:text-white cursor-pointer transition">
            <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files[0] && updateResume(e.target.files[0])} />
            {uploadingMedia === "resume" ? "Updating resume…" : "Update resume"}
          </label>
          <p className="text-fog/60 text-xs ml-auto">
            {state.jobCount} jobs indexed · last scan {state.lastSync ? new Date(state.lastSync).toLocaleString() : "never"}
            {!integrations.ai && " · demo AI (add ANTHROPIC_API_KEY)"}
            {!integrations.apollo && " · demo contacts (add APOLLO_API_KEY)"}
          </p>
        </div>

        <div className="bg-panel border border-edge rounded-2xl p-5 mb-6 flex flex-wrap items-center gap-4">
          <p className="font-semibold text-sm">Outreach channels</p>
          <button onClick={connectGmail} className={`text-sm rounded-full px-4 py-2 border transition ${state.connections?.gmail ? "border-mint text-mint" : "border-edge text-fog hover:text-white hover:border-mint"}`}>
            {state.connections?.gmail ? `✓ Gmail: ${state.connections.gmail.email}` : "Connect Gmail (send as you)"}
          </button>
          <button onClick={connectLinkedIn} className={`text-sm rounded-full px-4 py-2 border transition ${state.connections?.linkedin ? "border-mint text-mint" : "border-edge text-fog hover:text-white hover:border-mint"}`}>
            {state.connections?.linkedin
              ? `✓ LinkedIn connected${state.connections.linkedin.name ? ` · ${state.connections.linkedin.name}` : state.connections.linkedin.lastSeen ? ` · seen ${new Date(state.connections.linkedin.lastSeen).toLocaleTimeString()}` : ""}`
              : integrations.linkedinManaged ? "Connect LinkedIn" : "Connect LinkedIn (browser extension)"}
          </button>
          {state.liQueue?.pending > 0 && <span className="text-xs text-fog">{state.liQueue.pending} LinkedIn action(s) queued</span>}
          <div className="flex items-center gap-1 bg-ink border border-edge rounded-full p-1 ml-auto">
            {["manual", "automated"].map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`text-xs rounded-full px-3 py-1.5 transition ${(state.settings?.outreachMode || "manual") === m ? "bg-mint text-ink font-semibold" : "text-fog hover:text-white"}`}>
                {m === "manual" ? "Manual (save drafts)" : "Automated (send)"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full">
            <span className="text-fog/60 text-xs">Email style:</span>
            <div className="flex items-center gap-1 bg-ink border border-edge rounded-full p-1">
              {[["standard", "Standard"], ["founder_direct", "Founder-direct"]].map(([v, lbl]) => (
                <button key={v} onClick={() => setEmailStyle(v)} className={`text-xs rounded-full px-3 py-1.5 transition ${(state.settings?.emailStyle || "standard") === v ? "bg-mint text-ink font-semibold" : "text-fog hover:text-white"}`}>{lbl}</button>
              ))}
            </div>
            <span className="text-fog/50 text-xs">{(state.settings?.emailStyle || "standard") === "founder_direct" ? "short, no-buzzword cold emails straight to founders (Backdoor-style)" : "polished, pitch-page-led outreach"}</span>
          </div>
          <p className="text-fog/50 text-xs w-full">
            {(state.settings?.outreachMode || "manual") === "manual"
              ? "Manual: emails are saved as drafts in your Gmail for you to review and send. LinkedIn actions queue for the extension."
              : "Automated: Gigaprowl sends emails from your address directly. LinkedIn runs through the extension, paced to stay safe (ToS risk, keep volumes low)."}
          </p>
        </div>

        {state.connections?.linkedin?.status === "checkpoint" && (
          <div className="bg-panel border border-red-500/60 rounded-2xl p-4 mb-6">
            <p className="text-red-400 text-sm font-semibold">⚠ LinkedIn needs a re-login</p>
            <p className="text-fog text-sm mt-1">Your LinkedIn session hit a security check. Open LinkedIn in the browser running the extension, sign in / complete any prompt, and outreach resumes automatically.</p>
          </div>
        )}

        {liPair && (
          <div className="bg-panel border border-mint rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="font-display text-lg font-bold">Pair the LinkedIn engine</p>
              <button onClick={() => setLiPair(null)} className="text-fog hover:text-white text-sm">Close</button>
            </div>
            <ol className="text-sm text-fog space-y-2 mb-4 list-decimal list-inside">
              <li>Install the Gigaprowl extension (Chrome → Extensions → Load unpacked → the <code className="text-mint">extension/</code> folder).</li>
              <li>Click the Gigaprowl icon, paste the token below, hit <span className="text-mint">Save &amp; pair</span>.</li>
              <li>Stay logged into LinkedIn in that browser. Queued invites/DMs run automatically from your own session.</li>
            </ol>
            <div className="flex items-center gap-2 bg-ink border border-edge rounded-xl p-3">
              <code className="text-mint text-xs break-all flex-1">{liPair.token}</code>
              <button onClick={() => { navigator.clipboard.writeText(liPair.token); toast.success("Pairing token copied"); }} className="text-xs bg-mint text-ink font-bold rounded-full px-3 py-1.5 shrink-0">copy</button>
            </div>
          </div>
        )}

        {media && (!media.facePhoto || !media.voiceSample) && !mediaHidden && (
          <div className="bg-panel border border-edge rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-display text-lg font-bold">Enable personalized video</p>
                <p className="text-fog text-sm">Add your photo and a ~30s voice sample to put a 15-second avatar video of you, in your own voice, on every pitch page. Optional, and you can do it anytime.</p>
              </div>
              <button onClick={() => setMediaHidden(true)} className="text-fog hover:text-white text-sm shrink-0">Add later</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="border border-edge hover:border-mint rounded-xl p-5 text-center cursor-pointer transition">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadMedia("face", e.target.files[0])} />
                <p className="font-semibold text-sm mb-1">{media.facePhoto ? "✓ Photo added" : uploadingMedia === "face" ? "Uploading…" : "Add face photo"}</p>
                <p className="text-fog text-xs">JPG/PNG, front-facing, good light</p>
              </label>
              <div>
                <VoiceRecorder onUpload={(file) => uploadMedia("voice", file)} done={media.voiceSample} />
                {!media.voiceSample && (
                  <label className="block text-center cursor-pointer mt-3">
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files[0] && uploadMedia("voice", e.target.files[0])} />
                    <span className="text-fog/60 text-xs hover:text-mint transition underline underline-offset-2">or upload MP3, WAV, or M4A</span>
                  </label>
                )}
              </div>
            </div>
            {mediaError && <p className="text-red-400 mt-3 text-sm">{mediaError}</p>}
          </div>
        )}

        {!pitches.length && !applyKits.length && autopilot !== "running" && (
          <div className="bg-panel border border-edge rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Ready to generate outreach?</p>
              <p className="text-fog text-sm">Review your matches first. This creates pitch pages and cadence drafts; it does not send them.</p>
            </div>
            <button onClick={() => runAutopilot()} className="bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition">Generate for top matches</button>
          </div>
        )}
        {!!pitches.length && !!liteWithoutKit.length && autopilot !== "running" && (
          <div className="bg-panel border border-edge rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Kits for matches scored 50-74</p>
              <p className="text-fog text-sm">{liteWithoutKit.length} still need a kit. Resume bullets and an apply note, no credits.</p>
            </div>
            <button onClick={() => runAutopilot({ liteOnly: true })} className="bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition">Generate apply kits</button>
          </div>
        )}
        {autopilot === "running" && (
          <div className="bg-panel border border-mint rounded-2xl p-5 mb-6">
            <p className="text-mint font-semibold animate-pulse">🎯 Generating outreach drafts…</p>
            <p className="text-fog text-sm mt-1">75+ gets a pitch page, contacts, and outreach. 50-74 gets a kit. About a minute.</p>
          </div>
        )}
        {autopilot === "done" && (
          <div className="bg-panel border border-mint rounded-2xl p-5 mb-6">
            <p className="text-mint font-semibold">✓ Autopilot done. First hunts are ready.</p>
            <p className="text-fog text-sm mt-1">Pitch pages and Cadences for hunts. Apply kits for the rest. Videos take a couple of minutes.</p>
          </div>
        )}
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm transition ${tab === t ? "bg-mint text-ink font-semibold" : "text-fog hover:text-white border border-edge"}`}>
              {t} {t === "Matches" ? `(${matches.length})` : t === "Apply kits" ? `(${applyKits.length})` : t === "Contacts" ? `(${contacts.length})` : t === "Cadences" ? `(${cadences.length})` : t === "Activity" ? `(${(state.sends || []).length})` : t === "Social posts" ? `(${socialPosts.length})` : `(${pitches.length})`}
            </button>
          ))}
        </div>

        {tab === "Matches" && (
          <div className="space-y-3">
            {matches.length === 0 && <p className="text-fog">No matches yet. Hit Refresh jobs.</p>}
            {matches.map((m) => (
              <div key={m.id} className="bg-panel border border-edge rounded-2xl p-5 flex flex-wrap items-center gap-4">
                <div className={`font-display font-bold text-lg w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${m.score >= 70 ? "bg-mint text-ink" : "bg-edge text-mint"}`}>{m.score}</div>
                <div className="flex-1 min-w-[220px]">
                  <a href={m.job.url} target="_blank" className="font-semibold hover:text-mint transition">{m.job.title}</a>
                  <p className="text-fog text-sm">{m.job.company} · {m.job.location}{m.job.salary ? ` · ${m.job.salary}` : ""}</p>
                  <p className="text-fog/60 text-xs mt-1">{m.reasons.join(" · ")}</p>
                  {!integrations.apollo && (
                    <div className="flex flex-wrap gap-3 mt-3 text-xs">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in/ "${m.job.company}" ("hiring manager" OR "recruiter" OR "head of" OR "director") "${m.job.title}"`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-mint hover:underline"
                      >
                        Search Google for LinkedIn profiles ↗
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`"${m.job.company}" ("email" OR "contact") ("recruiter" OR "talent acquisition" OR "hiring manager")`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-mint hover:underline"
                      >
                        Search Google for public emails ↗
                      </a>
                    </div>
                  )}
                </div>
                {m.status === "outreach_ready" ? (
                  <div className="flex items-center gap-3">
                    <span className="text-mint text-sm font-semibold">✓ Outreach ready</span>
                    {kitIds.has(m.id) ? (
                      <button onClick={() => setTab("Apply kits")} className="text-mint text-sm font-semibold hover:underline">Apply kit</button>
                    ) : (
                      <button onClick={() => makeApplyKit(m.id)} disabled={!!hunting} className="text-fog hover:text-white text-xs border border-edge rounded-full px-3 py-1.5 transition disabled:opacity-50">
                        {hunting === m.id ? "Writing kit…" : kitRunning ? "Still writing…" : "Get apply kit"}
                      </button>
                    )}
                  </div>
                ) : m.status === "apply_kit_ready" || kitIds.has(m.id) ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setTab("Apply kits")} className="text-mint text-sm font-semibold hover:underline">Apply kit ready</button>
                    <button onClick={() => hunt(m.id)} disabled={!!hunting} className="text-fog hover:text-white text-xs border border-edge rounded-full px-3 py-1.5 transition disabled:opacity-50">
                      {hunting === m.id ? "Hunting…" : "Promote to full hunt (1 credit)"}
                    </button>
                  </div>
                ) : m.score < 75 ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => makeApplyKit(m.id)} disabled={!!hunting} className="bg-mint text-ink text-sm font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition disabled:opacity-50">
                      {hunting === m.id ? "Writing kit…" : "Get apply kit"}
                    </button>
                    <button onClick={() => hunt(m.id)} disabled={!!hunting} className="text-fog hover:text-white text-xs border border-edge rounded-full px-3 py-1.5 transition disabled:opacity-50">
                      {hunting === m.id ? "Hunting…" : "Hunt this (1 credit)"}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => hunt(m.id)} disabled={!!hunting} className="bg-mint text-ink text-sm font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition disabled:opacity-50">
                    {hunting === m.id ? "Hunting…" : "Hunt this (1 credit)"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "Apply kits" && (
          <div className="space-y-4">
            {applyKits.length === 0 && (
              <div className="bg-panel border border-edge rounded-2xl p-5">
                {kitRunning || autopilot === "running" ? (
                  <p className="text-mint font-semibold animate-pulse">Writing apply kits…</p>
                ) : (
                  <>
                    <p className="text-fog">Nothing here yet. Hunt a job and a kit shows up after outreach lands. Or generate kits for matches scored 50-74.</p>
                    {!!liteWithoutKit.length && (
                      <button onClick={() => runAutopilot({ liteOnly: true })} className="mt-4 bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition">
                        Generate apply kits ({liteWithoutKit.length})
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {applyKits.map((k) => {
              const score = kitScore(k);
              return (
              <div key={k.id} className="bg-panel border border-edge rounded-2xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <a href={k.job.url} target="_blank" className="font-semibold hover:text-mint transition">{k.job.title} @ {k.job.company}</a>
                    {typeof score === "number" && (
                      <p className="text-fog text-xs mt-0.5">match score {score}</p>
                    )}
                  </div>
                  <span className="text-xs border border-edge rounded-full px-3 py-1 text-fog">apply kit</span>
                </div>
                {k.fitNote && <p className="text-fog text-sm mb-4">{k.fitNote}</p>}
                <div className="border border-edge rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-mint text-xs font-semibold uppercase tracking-wider">resume bullets</p>
                    <button onClick={() => { navigator.clipboard.writeText((k.bullets || []).map((b) => `• ${b}`).join("\n")); toast.success("Bullets copied"); }} className="text-xs text-fog hover:text-mint transition">copy all</button>
                  </div>
                  <ul className="space-y-1.5">
                    {(k.bullets || []).map((b, i) => <li key={i} className="text-sm text-fog leading-relaxed">• {b}</li>)}
                  </ul>
                </div>
                <div className="border border-edge rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-mint text-xs font-semibold uppercase tracking-wider">apply note</p>
                    <button onClick={() => { navigator.clipboard.writeText(k.applyNote || ""); toast.success("Apply note copied"); }} className="text-xs text-fog hover:text-mint transition">copy</button>
                  </div>
                  <p className="text-sm text-fog whitespace-pre-wrap leading-relaxed">{k.applyNote}</p>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {tab === "Contacts" && (
          <div className="space-y-3">
            {contacts.length === 0 && <p className="text-fog">Hunt a match to discover its hiring manager.</p>}
            {contacts.map((c) => (
              <div key={c.id} className="bg-panel border border-edge rounded-2xl p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-fog text-sm">{c.title} · {c.company}</p>
                </div>
                <div className="text-sm text-fog space-x-4">
                  {c.email && <span>{c.email}</span>}
                  {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" className="text-mint hover:underline">LinkedIn</a>}
                  {!c.email && !c.linkedinUrl && <span className="text-fog/50 text-xs">{c.confidence}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Cadences" && (
          <div className="space-y-4">
            {cadences.length === 0 && <p className="text-fog">Hunt a match to draft its outreach cadence.</p>}
            {cadences.map((c) => (
              <div key={c.id} className="bg-panel border border-edge rounded-2xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <p className="font-semibold">{c.jobTitle} @ {c.company} <span className="text-fog font-normal text-sm">→ {c.contactName} ({c.contactTitle})</span></p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => restyle(c.id, c.style === "founder_direct" ? "standard" : "founder_direct")} disabled={restyling === c.id} className="text-xs border border-edge hover:border-mint hover:text-mint text-fog rounded-full px-3 py-1 transition disabled:opacity-50">
                      {restyling === c.id ? "rewriting…" : c.style === "founder_direct" ? "↺ standard style" : "✍️ founder-direct style"}
                    </button>
                    <span className="text-xs border border-edge rounded-full px-3 py-1 text-fog">review, then send</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {c.steps.map((s, i) => {
                    const li = /linkedin|connect|invite|dm/i.test(s.channel || "");
                    const ready = li ? !!state.connections?.linkedin : !!state.connections?.gmail;
                    const manual = (state.settings?.outreachMode || "manual") === "manual";
                    const doneLabel = s.status === "sent" ? "✓ sent" : s.status === "drafted" ? "✓ draft in Gmail" : s.status === "queued" ? "✓ queued" : null;
                    const action = li ? "send on LinkedIn" : manual ? "save as draft" : "send email";
                    const due = stepDate(c, s);
                    const dueLabel = doneLabel ? null : (due.getTime() <= Date.now() ? "due now" : `auto ${fmtDay(due)}`);
                    return (
                      <div key={i} className="border border-edge rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-mint text-xs font-semibold uppercase tracking-wider">Day {s.day} · {s.channel.replace("_", " ")}{s.subject ? ` · ${s.subject}` : ""}{dueLabel ? ` · ${dueLabel}` : ""}</p>
                          {doneLabel ? (
                            <span className="text-mint text-xs font-semibold shrink-0">{doneLabel}</span>
                          ) : (
                            <button
                              onClick={() => ready ? sendStep(c, i) : (li ? connectLinkedIn() : connectGmail())}
                              disabled={sending === `${c.id}:${i}`}
                              className="text-xs font-bold shrink-0 rounded-full px-4 py-1.5 bg-mint text-ink hover:bg-mintdim transition disabled:opacity-50"
                            >
                              {sending === `${c.id}:${i}` ? "working…" : ready ? action : `connect ${li ? "LinkedIn" : "Gmail"} first`}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-fog whitespace-pre-wrap leading-relaxed">{s.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Activity" && (
          <div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 text-xs text-fog/70">
              <span>Mode: <span className="text-mint">{(state.settings?.outreachMode || "manual") === "manual" ? "manual (drafts)" : "automated (sends)"}</span></span>
              <span>Auto-run: <span className="text-mint">daily</span></span>
              {state.liQueue?.pending > 0 && <span>{state.liQueue.pending} LinkedIn queued</span>}
              {state.connections?.linkedin?.lastSeen && <span>extension seen {new Date(state.connections.linkedin.lastSeen).toLocaleString()}</span>}
            </div>
            {(state.sends || []).length === 0 ? (
              <p className="text-fog">nothing sent yet. sent emails, drafts, and LinkedIn actions will show up here with timestamps.</p>
            ) : (
              <div className="space-y-2">
                {[...(state.sends || [])].reverse().map((sd) => {
                  const label = sd.channel === "linkedin_invite" ? "LinkedIn invite" : sd.channel === "linkedin_dm" ? "LinkedIn DM" : "Email";
                  const color = sd.status === "sent" ? "text-mint" : sd.status === "drafted" ? "text-fog" : sd.status === "queued" ? "text-fog" : "text-red-400";
                  const icon = sd.status === "sent" ? "✓ sent" : sd.status === "drafted" ? "📝 draft" : sd.status === "queued" ? "⏳ queued" : "✕ failed";
                  return (
                    <div key={sd.id} className="bg-panel border border-edge rounded-xl px-4 py-3 flex items-center gap-4 text-sm">
                      <span className={`${color} font-semibold shrink-0 w-20`}>{icon}</span>
                      <span className="text-fog shrink-0 w-28">{label}</span>
                      <span className="flex-1 truncate text-fog/80">{sd.to || "—"}</span>
                      <span className="text-fog/50 text-xs shrink-0">{new Date(sd.at).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "Pitch pages" && (
          <div className="space-y-3">
            {pitches.length === 0 && <p className="text-fog">Hunt a match to generate its personalized pitch page + video script.</p>}
            {pitches.map((p) => (
              <div key={p.slug} className="bg-panel border border-edge rounded-2xl p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold">{p.headline || `Pitch for ${p.job?.company || "…"}`}</p>
                  <p className="text-fog text-sm">{p.job?.title} @ {p.job?.company} · video: {(p.videoStatus || "pending").replace("_", " ")}</p>
                </div>
                <a href={`/p/${p.slug}`} target="_blank" className="bg-mint text-ink text-sm font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition">View live page →</a>
              </div>
            ))}
          </div>
        )}

        {tab === "Social posts" && (
          <div className="space-y-4">
            {socialPosts.length === 0 && (socialRunning
              ? <p className="text-mint animate-pulse">✍️ writing your posts, fact-checked against your résumé, ~30s…</p>
              : <p className="text-fog">no social posts yet. every full hunt drafts a LinkedIn post + X thread that put your work in the target company's feed.</p>)}
            {socialPosts.length > 0 && (
              <>
                <p className="text-fog/70 text-xs">review before posting. post it yourself: your voice, your profile. gigaprowl never publishes on your behalf.</p>
                <p className="text-fog/70 text-xs">✓ fact-checked against your résumé. still give it your own read before posting</p>
              </>
            )}
            {socialPosts.map((p) => (
              <div key={p.id} className="bg-panel border border-edge rounded-2xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold">{p.jobTitle ? `${p.jobTitle} @ ` : ""}{p.company}</p>
                    {p.angle && <p className="text-fog text-xs mt-0.5">{p.angle}</p>}
                  </div>
                  <span className="text-xs border border-edge rounded-full px-3 py-1 text-fog">signal boost 📣</span>
                </div>
                <div className="border border-edge rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-mint text-xs font-semibold uppercase tracking-wider">linkedin post</p>
                    <button onClick={() => { navigator.clipboard.writeText(p.linkedinPost || ""); toast.success("LinkedIn post copied"); }} className="text-xs text-fog hover:text-mint transition">copy</button>
                  </div>
                  <p className="text-sm text-fog whitespace-pre-wrap leading-relaxed">{p.linkedinPost}</p>
                </div>
                <div className="border border-edge rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-mint text-xs font-semibold uppercase tracking-wider">x / twitter thread</p>
                    <button onClick={() => { navigator.clipboard.writeText((p.twitterThread || []).join("\n\n")); toast.success("Thread copied"); }} className="text-xs text-fog hover:text-mint transition">copy thread</button>
                  </div>
                  <ol className="space-y-2">
                    {(p.twitterThread || []).map((t, i) => (
                      <li key={i} className="text-sm text-fog leading-relaxed flex gap-2">
                        <span className="text-mint/60 shrink-0">{i + 1}/</span>
                        <span className="whitespace-pre-wrap">{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="text-fog/50 text-xs mt-3">review, tweak to taste, then post from your own account. that's the whole point.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
