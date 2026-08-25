"use client";
import { useState } from "react";
import Link from "next/link";
import cases from "../../../scripts/contact-cases.json";

const REASONS = {
  missing_key: "No APOLLO_API_KEY in env",
  apollo_http_error: "Apollo HTTP error",
  pass1_empty: "Pass 1 and pass 2 both returned nobody",
  pass2_filtered: "Pass 2 had people, but sameCompany dropped all of them",
  enrichment_empty: "Apollo search hits existed, people/match returned no usable names",
};

export default function ContactProbe() {
  const [custom, setCustom] = useState({ company: "", title: "", domain: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(null);

  async function probe(job, key) {
    setBusy(key);
    setError(null);
    setPicked(key);
    setResult(null);
    try {
      const r = await fetch("/api/test/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) {
        window.location.href = "/login?mode=login";
        return;
      }
      if (!r.ok) setError(d.error || `Request failed (${r.status})`);
      else setResult(d);
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  }

  return (
    <div className="min-h-screen bg-ink text-white pb-24">
      <nav className="border-b border-edge">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-xl font-bold">gigaprowl<span className="text-mint">.</span></Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/test" className="text-fog hover:text-white">Test bench</Link>
            <span className="text-fog/60">contact probe</span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Contact probe</h1>
          <p className="text-fog text-sm mt-1">Same Apollo path as hunt. Empty means Apollo found nobody, not a demo Alex/Jordan.</p>
        </div>

        <div className="space-y-2">
          {cases.map((job, i) => {
            const key = `${job.company}|${job.title}|${job.domain || ""}|${i}`;
            const active = picked === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!!busy}
                onClick={() => probe({ company: job.company, title: job.title, domain: job.domain || "" }, key)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  active ? "border-mint bg-mint/10" : "border-edge bg-panel hover:border-fog/40"
                } disabled:opacity-50`}
              >
                <div className="font-medium">{job.company} · {job.title}</div>
                <div className="text-xs text-fog mt-0.5">{job.domain ? `domain ${job.domain}` : "domain guessed like hunt"}</div>
              </button>
            );
          })}
        </div>

        <form
          className="rounded-xl border border-edge bg-panel px-4 py-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!custom.company.trim() || !custom.title.trim()) return;
            probe(
              { company: custom.company.trim(), title: custom.title.trim(), domain: custom.domain.trim() },
              "custom",
            );
          }}
        >
          <div className="text-xs uppercase tracking-wide text-fog">Custom</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
              placeholder="Company"
              value={custom.company}
              onChange={(e) => setCustom({ ...custom, company: e.target.value })}
            />
            <input
              className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
              placeholder="Role"
              value={custom.title}
              onChange={(e) => setCustom({ ...custom, title: e.target.value })}
            />
            <input
              className="bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
              placeholder="Domain (optional)"
              value={custom.domain}
              onChange={(e) => setCustom({ ...custom, domain: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={!!busy || !custom.company.trim() || !custom.title.trim()}
            className="text-sm bg-mint text-ink font-semibold rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            {busy === "custom" ? "Fetching…" : "Fetch contacts"}
          </button>
        </form>

        {busy && <p className="text-fog text-sm">Fetching contacts…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result && <ProbeResult result={result} />}
      </div>
    </div>
  );
}

function ProbeResult({ result }) {
  const { contacts, debug } = result;
  const reason = debug?.reason;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-edge bg-panel px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-fog">Contacts</div>
        {!contacts?.length && (
          <p className="mt-2 text-sm text-fog">None. {REASONS[reason] || reason || "No usable people."}</p>
        )}
        <div className="mt-2 space-y-2">
          {contacts?.map((c) => (
            <div key={c.id || c.name} className="rounded-lg border border-edge px-3 py-2">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-fog">{[c.title, c.company].filter(Boolean).join(" · ")}</div>
              <div className="text-xs text-fog/80 mt-1">
                {c.email || "no email"}
                {c.emailStatus ? ` (${c.emailStatus})` : ""}
                {c.linkedinUrl ? ` · ${c.linkedinUrl}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-edge bg-panel px-4 py-3 space-y-2 text-sm">
        <div className="text-xs uppercase tracking-wide text-fog">Trace</div>
        <Row label="Titles searched" value={(debug.titles || []).join(", ") || "—"} />
        <Row label="Org filter" value={`${debug.orgFilter || "—"} = ${debug.orgValue || "—"}`} />
        <Row label="Hunt would guess" value={debug.guessedDomain || "—"} />
        <Row label="Pass 1" value={`${debug.pass1?.count ?? 0} hits${debug.pass1?.status ? ` (HTTP ${debug.pass1.status})` : ""}`} />
        {!!debug.pass1?.people?.length && <HitList people={debug.pass1.people} />}
        <Row
          label="Pass 2"
          value={debug.pass2?.used
            ? `${debug.pass2.count} hits, ${debug.pass2.matched} kept, ${debug.pass2.dropped?.length || 0} dropped`
            : "not used (pass 1 had hits)"}
        />
        {!!debug.pass2?.dropped?.length && (
          <div className="text-xs text-fog pl-1">
            Dropped: {debug.pass2.dropped.map((p) => `${p.name || "?"} (${p.org || p.domain || "?"})`).join("; ")}
          </div>
        )}
        <Row label="Enrichment" value={`${debug.enrichment?.kept ?? 0}/${debug.enrichment?.attempted ?? 0} kept`} />
        {!!debug.enrichment?.failures?.length && (
          <div className="text-xs text-fog pl-1">
            Failed: {debug.enrichment.failures.map((p) => `${p.name || "?"} (${p.why})`).join("; ")}
          </div>
        )}
        {debug.errorNote && <Row label="Apollo note" value={debug.errorNote} />}
        <Row label="Reason" value={reason ? (REASONS[reason] || reason) : "ok"} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <span className="text-fog">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function HitList({ people }) {
  return (
    <ul className="text-xs text-fog pl-4 list-disc">
      {people.map((p, i) => (
        <li key={`${p.name}-${i}`}>{[p.name, p.title, p.org].filter(Boolean).join(" · ")}</li>
      ))}
    </ul>
  );
}
