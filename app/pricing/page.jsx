"use client";
import Link from "next/link";
import { useState } from "react";

const TIERS = [
  { key: "free", name: "Free", price: "$0", per: "forever", credits: "5 hunts included", blurb: "Five hunts. No card.", popular: false,
    features: ["AI resume analysis & fit profile", "Job matches from 400+ top companies, refreshed daily", "5 full hunts: hiring manager + pitch page + AI video", "Outreach cadences drafted for you"], cta: "Start free" },
  { key: "plus", name: "Plus", price: "$19", per: "/month", credits: "50 hunts / month", blurb: "For an active search.", popular: true,
    features: ["Everything in Free", "50 hunts every month", "Personalized AI avatar video on every pitch", "Hosted pitch pages with your own link", "Email + LinkedIn cadences, export to Smartlead"], cta: "Go Plus" },
  { key: "max", name: "Max", price: "$49", per: "/month", credits: "200 hunts / month", blurb: "For a heavy search.", popular: false,
    features: ["Everything in Plus", "200 hunts every month", "Priority daily scans on your profile", "UGC-ready pitch clips for LinkedIn/X", "Early access to auto-send (coming soon)"], cta: "Go Max" },
];

export default function Pricing() {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  async function buy(key) {
    if (key === "free") { window.location.href = "/login"; return; }
    setBusy(key); setErr(null);
    const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: key }) });
    const d = await r.json();
    setBusy(null);
    if (r.status === 401) { window.location.href = "/login"; return; }
    if (!r.ok) return setErr(d.error || "Checkout failed");
    window.location.href = d.url;
  }

  return (
    <div className="min-h-screen bg-ink">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-2xl font-bold">gigaprowl<span className="text-mint">.</span></Link>
        <Link href="/login" className="bg-mint text-ink font-semibold px-5 py-2.5 rounded-full hover:bg-mintdim transition text-sm">Start hunting</Link>
      </nav>
      <header className="text-center px-6 pt-16 pb-12">
        <h1 className="font-display text-5xl font-bold mb-4">Upload a resume. We do the rest<span className="text-mint">.</span></h1>
        <p className="text-fog max-w-xl mx-auto">One hunt is one company. We find the hiring manager, build a pitch page, render an AI video of you, and draft the outreach. You hit send.</p>
      </header>
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 px-6 pb-10">
        {TIERS.map((t) => (
          <div key={t.key} className={`rounded-2xl p-8 border ${t.popular ? "border-mint bg-panel shadow-[0_0_60px_-15px_#3DFFA2]" : "border-edge bg-panel"}`}>
            {t.popular && <p className="text-mint text-xs font-bold tracking-widest uppercase mb-3">Most popular</p>}
            <h2 className="font-display text-2xl font-bold mb-1">{t.name}</h2>
            <p className="text-4xl font-display font-bold mb-1">{t.price}<span className="text-lg text-fog font-normal">{t.per}</span></p>
            <p className="text-mint text-sm mb-2">{t.credits}</p>
            <p className="text-fog text-sm mb-6">{t.blurb}</p>
            <ul className="space-y-2.5 mb-8">
              {t.features.map((f) => (
                <li key={f} className="text-sm text-fog flex gap-2"><span className="text-mint">✓</span>{f}</li>
              ))}
            </ul>
            <button onClick={() => buy(t.key)} disabled={busy === t.key}
              className={`w-full text-center font-bold px-6 py-3 rounded-full transition disabled:opacity-50 ${t.popular ? "bg-mint text-ink hover:bg-mintdim" : "border border-edge hover:border-mint"}`}>
              {busy === t.key ? "One sec…" : t.cta}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="text-center text-red-400 text-sm pb-6">{err}</p>}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-edge bg-panel p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold mb-2">Enterprise & partners</h2>
            <p className="text-fog text-sm">Universities, bootcamps, outplacement firms, recruiters. Bulk seats, your branding on pitch pages, placement numbers, and a cut when someone you send actually gets hired.</p>
          </div>
          <a href="mailto:partnerships@gigaprowl.jobs?subject=Gigaprowl%20Enterprise" className="border border-mint text-mint font-bold px-8 py-3 rounded-full hover:bg-mint hover:text-ink transition">Talk to us</a>
        </div>
        <p className="text-center text-fog/60 text-xs mt-8">Cancel anytime. Unused monthly hunts roll over while subscribed. Videos use your own face and voice, with consent. Delete anytime.</p>
      </div>
    </div>
  );
}
