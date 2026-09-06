"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [state, setState] = useState("checking"); // checking | valid | invalid | done
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) { setState("invalid"); return; }
    fetch(`/api/auth/reset?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => setState(d.valid ? "valid" : "invalid"))
      .catch(() => setState("invalid"));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    setBusy(true);
    const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setState("done");
    else setErr(d.error || "Something went wrong.");
  }

  const input = "w-full bg-ink border border-edge focus:border-mint rounded-xl px-4 py-2.5 text-sm outline-none";

  return (
    <div className="min-h-dvh bg-ink text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-panel border border-edge rounded-2xl p-8">
        <div className="font-display text-2xl font-bold mb-6 text-center">gigaprowl<span className="text-mint">.</span></div>
        {state === "checking" && <p className="text-fog text-sm text-center">Checking your link…</p>}
        {state === "invalid" && (
          <div className="text-center">
            <h1 className="font-display text-xl font-bold text-balance mb-2">Link expired</h1>
            <p className="text-pretty text-fog text-sm mb-6">This reset link is invalid or has expired. Request a new one.</p>
            <Link href="/login?forgot=1" className="inline-block bg-mint text-ink font-bold px-6 py-2.5 rounded-full">Request new link</Link>
          </div>
        )}
        {state === "valid" && (
          <form onSubmit={submit}>
            <h1 className="font-display text-xl font-bold text-balance mb-4">Choose a new password</h1>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className={input + " mb-3"} />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" className={input + " mb-3"} />
            {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
            <button disabled={busy} className="w-full bg-mint text-ink font-bold px-6 py-2.5 rounded-full disabled:opacity-40">{busy ? "Saving…" : "Reset password"}</button>
          </form>
        )}
        {state === "done" && (
          <div className="text-center">
            <div className="text-4xl mb-3">✓</div>
            <h1 className="font-display text-xl font-bold text-balance mb-2">Password updated</h1>
            <p className="text-pretty text-fog text-sm mb-6">You're signed in with your new password.</p>
            <Link href="/dashboard" className="inline-block bg-mint text-ink font-bold px-6 py-2.5 rounded-full">Go to dashboard →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
