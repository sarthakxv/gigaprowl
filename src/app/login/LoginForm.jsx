"use client";

import { useState } from "react";
import Link from "next/link";
import { browserAuth } from "@/lib/supabase-browser";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendLink(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL;
      if (!base) throw new Error("Sign-in redirect is not configured");
      const { error: authError } = await browserAuth().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${base.replace(/\/$/, "")}/auth/callback` },
      });
      if (authError) throw authError;
      setMessage("Check your inbox for your sign-in link.");
    } catch (e) {
      setError(e.message || "Could not send your sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function signInGoogle() {
    setBusy(true);
    setError("");
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL;
      if (!base) throw new Error("Sign-in redirect is not configured");
      const { error: authError } = await browserAuth().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${base.replace(/\/$/, "")}/auth/callback` },
      });
      if (authError) throw authError;
    } catch (e) {
      setError(e.message || "Google sign-in is unavailable.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ink flex flex-col items-center justify-center px-6">
      <Link href="/" className="font-display text-3xl font-bold mb-10">gigaprowl<span className="text-mint">.</span></Link>
      <div className="w-full max-w-sm bg-panel border border-edge rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold mb-2">Get started</h1>
        <p className="text-fog text-sm mb-6">Sign in or create an account with a secure email link.</p>
        <form onSubmit={sendLink}>
          <label htmlFor="email" className="block text-sm mb-2">Email</label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email"
            className="w-full bg-ink border border-edge rounded-xl px-4 py-3 mb-4 text-sm focus:border-mint outline-none" />
          <button disabled={busy} className="w-full bg-mint text-ink font-bold py-3 rounded-full hover:bg-mintdim transition disabled:opacity-50">
            {busy ? "One sec…" : "Email me a sign-in link"}
          </button>
        </form>
        <div className="text-center text-fog text-sm my-5">or</div>
        <button type="button" onClick={signInGoogle} disabled={busy}
          className="w-full border border-edge rounded-full py-3 font-semibold hover:border-mint transition disabled:opacity-50">
          Continue with Google
        </button>
        {message && <p role="status" className="text-mint text-sm mt-5">{message}</p>}
        {error && <p role="alert" className="text-red-400 text-sm mt-5">{error}</p>}
      </div>
    </div>
  );
}
