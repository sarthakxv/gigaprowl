"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

export default function TestBench() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null);
  const [liUrl, setLiUrl] = useState("");
  const [liMsg, setLiMsg] = useState("Hi. Testing Gigaprowl's LinkedIn outreach. Ignore this!");
  const [emTo, setEmTo] = useState("");
  const [emSub, setEmSub] = useState("Test from Gigaprowl (Resend)");
  const [emBody, setEmBody] = useState("This is a test email sent from Gigaprowl via Resend. If you got this, email sending works.");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/state");
    if (r.status === 401) { window.location.href = "/login?mode=login"; return; }
    setState(await r.json());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("connect");
    if (c === "linkedin_ok") {
      const toastId = toast.loading("Finishing LinkedIn connection…");
      window.history.replaceState({}, "", "/test");
      // Actively reconcile with Unipile (don't depend on the webhook firing).
      (async () => {
        try {
          const r = await fetch("/api/connect/linkedin/sync", { method: "POST" });
          const d = await r.json().catch(() => ({}));
          if (d.connected) toast.success("LinkedIn connected", { id: toastId });
          else toast.error("Connected, but couldn't confirm the account. Try again.", { id: toastId });
        } catch { toast.error("Connected, but sync failed. Refresh and retry.", { id: toastId }); }
        refresh();
      })();
    }
    if (c === "linkedin_failed") { toast.error("LinkedIn connection didn't complete."); window.history.replaceState({}, "", "/test"); }
  }, [refresh]);

  async function connectLinkedIn() {
    setBusy("connect");
    const r = await fetch("/api/connect/linkedin");
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok && d.url) window.location.href = d.url; // redirect (Unipile recommends no iframe)
    else toast.error(d.error || "Couldn't start LinkedIn connection.");
  }
  async function sendInvite(dm) {
    setBusy(dm ? "dm" : "invite");
    const r = await fetch("/api/test/linkedin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileUrl: liUrl, message: liMsg, dm }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) toast.success(`${dm ? "DM" : "Connection request"} sent`);
    else toast.error(d.error || "Failed");
  }
  async function sendEmail() {
    setBusy("email");
    const r = await fetch("/api/test/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: emTo, subject: emSub, body: emBody }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) toast.success(`Email sent via Resend (id ${String(d.messageId).slice(0, 8)}…)`);
    else toast.error(d.error || "Failed");
  }

  if (!state) return <div className="min-h-screen bg-ink flex items-center justify-center text-fog">Loading…</div>;
  const li = state.connections?.linkedin;
  const ig = state.integrations || {};
  const Pill = ({ ok, children }) => <span className={`text-xs rounded-full px-3 py-1 ${ok ? "bg-mint/15 text-mint" : "bg-red-500/15 text-red-400"}`}>{children}</span>;

  return (
    <div className="min-h-screen bg-ink text-white pb-24">
      <nav className="border-b border-edge">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-xl font-bold">gigaprowl<span className="text-mint">.</span></Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-fog hover:text-white">Dashboard</Link>
            <span className="text-fog/60">outreach test bench</span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Outreach test bench</h1>
          <p className="text-fog text-sm">Send a real LinkedIn connection request and a real email, then run the full cadence from the dashboard.</p>
        </div>

        <div className="bg-panel border border-edge rounded-2xl p-5 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">Status:</span>
          <Pill ok={ig.linkedinManaged}>LinkedIn {ig.linkedinManaged ? "configured" : "not configured"}</Pill>
          <Pill ok={!!li?.accountId}>{li?.accountId ? `LinkedIn connected${li.name ? ` (${li.name})` : ""}` : "LinkedIn not connected"}</Pill>
          <Pill ok={ig.resend}>Resend {ig.resend ? "configured" : "missing key"}</Pill>
        </div>

        {/* 1. Connect LinkedIn */}
        <div className="bg-panel border border-edge rounded-2xl p-6">
          <p className="font-semibold mb-1">1 · Connect your LinkedIn</p>
          <p className="text-fog text-sm mb-4">Opens a secure connection window where you sign in to LinkedIn. Gigaprowl never displays or stores your LinkedIn password.</p>
          <button onClick={connectLinkedIn} disabled={busy === "connect" || !ig.linkedinManaged} className="bg-mint text-ink font-bold px-6 py-2.5 rounded-full hover:bg-mintdim transition disabled:opacity-40">
            {li?.accountId ? "Reconnect LinkedIn" : busy === "connect" ? "Opening…" : "Connect LinkedIn"}
          </button>
          {!ig.linkedinManaged && <p className="text-red-400 text-xs mt-3">LinkedIn connection is not configured.</p>}
        </div>

        {/* 2. LinkedIn test */}
        <div className="bg-panel border border-edge rounded-2xl p-6">
          <p className="font-semibold mb-1">2 · Send a LinkedIn connection request / DM</p>
          <p className="text-fog text-sm mb-4">Paste a profile URL (e.g. your own or a friend's). Invite works for non-connections; DM only works for existing connections (or Premium InMail).</p>
          <input value={liUrl} onChange={(e) => setLiUrl(e.target.value)} placeholder="https://www.linkedin.com/in/username/" className="w-full bg-ink border border-edge focus:border-mint rounded-xl px-4 py-2.5 text-sm mb-3 outline-none" />
          <textarea value={liMsg} onChange={(e) => setLiMsg(e.target.value)} rows={2} className="w-full bg-ink border border-edge focus:border-mint rounded-xl px-4 py-2.5 text-sm mb-3 outline-none resize-none" />
          <div className="flex gap-3">
            <button onClick={() => sendInvite(false)} disabled={!!busy || !li?.accountId || !liUrl} className="bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition disabled:opacity-40">{busy === "invite" ? "Sending…" : "Send connection request"}</button>
            <button onClick={() => sendInvite(true)} disabled={!!busy || !li?.accountId || !liUrl} className="text-fog border border-edge hover:border-mint hover:text-white px-5 py-2.5 rounded-full transition disabled:opacity-40">{busy === "dm" ? "Sending…" : "Send DM"}</button>
          </div>
        </div>

        {/* 3. Email test */}
        <div className="bg-panel border border-edge rounded-2xl p-6">
          <p className="font-semibold mb-1">3 · Send a test email (Resend)</p>
          <p className="text-fog text-sm mb-4">With the test sender, send to your own account email. For arbitrary recipients, verify a domain in Resend and set RESEND_FROM.</p>
          <input value={emTo} onChange={(e) => setEmTo(e.target.value)} placeholder="your@email.com" className="w-full bg-ink border border-edge focus:border-mint rounded-xl px-4 py-2.5 text-sm mb-3 outline-none" />
          <input value={emSub} onChange={(e) => setEmSub(e.target.value)} className="w-full bg-ink border border-edge focus:border-mint rounded-xl px-4 py-2.5 text-sm mb-3 outline-none" />
          <textarea value={emBody} onChange={(e) => setEmBody(e.target.value)} rows={3} className="w-full bg-ink border border-edge focus:border-mint rounded-xl px-4 py-2.5 text-sm mb-3 outline-none resize-none" />
          <button onClick={sendEmail} disabled={!!busy || !ig.resend || !emTo} className="bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition disabled:opacity-40">{busy === "email" ? "Sending…" : "Send via Resend"}</button>
        </div>

        {/* 4. Full cadence */}
        <div className="bg-panel border border-edge rounded-2xl p-6">
          <p className="font-semibold mb-1">4 · Run the full cadence</p>
          <p className="text-fog text-sm mb-4">LinkedIn and email cadence steps dispatch automatically. Hunt a match on the dashboard, then hit "send" on each step, or let the daily scheduler release them.</p>
          <Link href="/dashboard" className="inline-block bg-mint text-ink font-bold px-6 py-2.5 rounded-full hover:bg-mintdim transition">Go to dashboard → run a cadence</Link>
        </div>
      </div>
    </div>
  );
}
