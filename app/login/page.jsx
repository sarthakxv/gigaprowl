"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function pathAfterAuth(userState) {
  return userState?.profile ? "/dashboard" : "/onboarding";
}

async function loadUserState() {
  const r = await fetch("/api/state", { cache: "no-store" });
  if (r.status === 401 || !r.ok) return null;
  return r.json().catch(() => null);
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "login" ? "login" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [forgot, setForgot] = useState(params.get("forgot") === "1");
  const [forgotMsg, setForgotMsg] = useState(null);
  const skipAuthedRedirect = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadUserState().then((userState) => {
      if (cancelled || skipAuthedRedirect.current || !userState) return;
      router.replace(pathAfterAuth(userState));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    skipAuthedRedirect.current = true;
    setBusy(true); setError(null);
    const r = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const d = await r.json();
    if (!r.ok) {
      setBusy(false);
      return setError(d.error || "Something went wrong");
    }
    if (mode === "signup") {
      router.replace("/onboarding");
      return;
    }
    const userState = await loadUserState().catch(() => null);
    setBusy(false);
    router.replace(pathAfterAuth(userState));
  }

  async function sendForgot(e) {
    e.preventDefault();
    setBusy(true); setForgotMsg(null);
    const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setForgotMsg(d.message || "If an account exists for that email, a reset link is on its way.");
  }

  if (forgot) {
    return (
      <div className="min-h-dvh bg-ink flex flex-col items-center justify-center px-6">
        <Link href="/" className="font-display text-3xl font-bold mb-10">gigaprowl<span className="text-mint">.</span></Link>
        <form onSubmit={sendForgot} className="w-full max-w-sm bg-panel border border-edge rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold text-balance mb-2">Reset password</h1>
          <p className="text-pretty text-fog text-sm mb-5">Enter your email and we'll send you a reset link.</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email"
            className="w-full bg-ink border border-edge rounded-xl px-4 py-3 mb-4 text-sm focus:border-mint outline-none" />
          {forgotMsg && <p className="text-mint text-sm mb-4">{forgotMsg}</p>}
          <button disabled={busy} className="w-full bg-mint text-ink font-bold py-3 rounded-full hover:bg-mintdim transition disabled:opacity-50">
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-fog text-sm text-center mt-5">
            <button type="button" onClick={() => { setForgot(false); setForgotMsg(null); }} className="text-mint hover:underline">← Back to login</button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-ink flex flex-col items-center justify-center px-6">
      <Link href="/" className="font-display text-3xl font-bold mb-10">gigaprowl<span className="text-mint">.</span></Link>
      <form onSubmit={submit} className="w-full max-w-sm bg-panel border border-edge rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold text-balance mb-6">{mode === "signup" ? "let's get you hired" : "welcome back"}</h1>
        {mode === "signup" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
            className="w-full bg-ink border border-edge rounded-xl px-4 py-3 mb-3 text-sm focus:border-mint outline-none" />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email"
          className="w-full bg-ink border border-edge rounded-xl px-4 py-3 mb-3 text-sm focus:border-mint outline-none" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8}
          placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          className="w-full bg-ink border border-edge rounded-xl px-4 py-3 mb-5 text-sm focus:border-mint outline-none" />
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {mode === "login" && (
          <p className="text-right -mt-2 mb-4">
            <button type="button" onClick={() => { setForgot(true); setError(null); }} className="text-fog hover:text-mint text-xs">Forgot password?</button>
          </p>
        )}
        <button disabled={busy} className="w-full bg-mint text-ink font-bold py-3 rounded-full hover:bg-mintdim transition disabled:opacity-50">
          {busy ? "One sec…" : mode === "signup" ? "Create account →" : "Log in →"}
        </button>
        <p className="text-fog text-sm text-center mt-5">
          {mode === "signup" ? "Already hunting?" : "New here?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }} className="text-mint hover:underline">
            {mode === "signup" ? "Log in" : "Create an account"}
          </button>
        </p>
      </form>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <LoginForm />
    </Suspense>
  );
}
