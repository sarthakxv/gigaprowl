"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function VerifyPage() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    setStatus(s || "pending");
  }, []);

  const ok = status === "ok";
  const invalid = status === "invalid";

  return (
    <div className="min-h-screen bg-ink text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-panel border border-edge rounded-2xl p-8 text-center">
        <div className="font-display text-2xl font-bold mb-6">gigaprowl<span className="text-mint">.</span></div>
        {ok && (
          <>
            <div className="text-5xl mb-4">✓</div>
            <h1 className="font-display text-2xl font-bold mb-2">Email confirmed</h1>
            <p className="text-fog text-sm mb-6">Your account is active. Open the dashboard and start hunting.</p>
            <Link href="/dashboard" className="inline-block bg-mint text-ink font-bold px-6 py-2.5 rounded-full hover:bg-mintdim transition">Go to dashboard →</Link>
          </>
        )}
        {invalid && (
          <>
            <h1 className="font-display text-2xl font-bold mb-2">Link expired or invalid</h1>
            <p className="text-fog text-sm mb-6">This verification link is no longer valid. Sign in and request a fresh one from your dashboard.</p>
            <Link href="/login" className="inline-block bg-mint text-ink font-bold px-6 py-2.5 rounded-full hover:bg-mintdim transition">Sign in</Link>
          </>
        )}
        {status === "loading" && <p className="text-fog text-sm">Checking…</p>}
        {status === "pending" && (
          <>
            <h1 className="font-display text-2xl font-bold mb-2">Check your inbox</h1>
            <p className="text-fog text-sm">We sent you a confirmation link. Click it to activate your account.</p>
          </>
        )}
      </div>
    </div>
  );
}
