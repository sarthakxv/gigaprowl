import Link from "next/link";

const COMPANIES = ["Stripe", "Figma", "Notion", "Databricks", "Cloudflare", "Vercel", "Rippling", "Brex", "Plaid", "GitLab", "Airtable", "Netflix"];

const STEPS = [
  { e: "📄", t: "drop your resume", d: "that's it. that's the whole onboarding. we read it and figure out exactly what you're good at." },
  { e: "🎯", t: "we find your people", d: "every day we scan 400+ top companies. not job boards. the actual hiring managers who'd be your boss." },
  { e: "🎬", t: "you, but everywhere", d: "we make a personal pitch page + an AI video of you (your face, your voice) for every single company. with your consent, obviously." },
  { e: "📬", t: "outreach on autopilot", d: "emails + linkedin messages, written and sequenced. you review, hit send, and go touch grass." },
];

const RECEIPTS = [
  ["250+", "people apply to every posting. your resume is a lottery ticket in there."],
  ["2%", "reply rate on cold applications. the portal is where resumes go to die."],
  ["3", "companies hunted for you in your first 5 minutes. automatically."],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink overflow-hidden">
      {/* glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, #3DFFA2 0%, transparent 70%)" }} />

      <nav className="relative max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-bold">gigaprowl<span className="text-mint">.</span></span>
        <div className="flex items-center gap-5 text-sm text-fog">
          <Link href="/pricing" className="hover:text-white">pricing</Link>
          <Link href="/login?mode=login" className="hover:text-white">log in</Link>
          <Link href="/login" className="bg-mint text-ink font-bold px-5 py-2.5 rounded-full hover:bg-mintdim transition">get hired →</Link>
        </div>
      </nav>

      <header className="relative max-w-4xl mx-auto text-center px-6 pt-16 pb-16">
        <p className="inline-block bg-panel border border-edge rounded-full px-4 py-1.5 text-sm text-fog mb-8">the job market is cooked. you don't have to be.</p>
        <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] mb-6">
          stop applying.<br />
          <span className="text-mint">start getting noticed.</span>
        </h1>
        <p className="text-fog text-xl max-w-2xl mx-auto mb-10">
          upload your resume once. gigaprowl finds the companies, DMs the actual hiring manager, and pitches you with a personal page + an AI video of <span className="text-white">you</span>. while you sleep.
        </p>
        <Link href="/login" className="inline-block bg-mint text-ink font-bold text-lg px-10 py-4 rounded-full hover:bg-mintdim hover:scale-105 transition">
          drop your resume → it's free
        </Link>
        <p className="text-fog/60 text-sm mt-4">5 free hunts · no card · 2-minute setup</p>
      </header>

      {/* company ticker */}
      <div className="relative border-y border-edge py-4 mb-20 overflow-hidden">
        <div className="flex gap-10 whitespace-nowrap opacity-60 justify-center flex-wrap px-4">
          {COMPANIES.map((c) => <span key={c} className="text-fog text-sm font-semibold">{c}</span>)}
        </div>
        <p className="text-center text-fog/50 text-xs mt-2">scanned daily. fresh openings, real hiring managers.</p>
      </div>

      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <h2 className="font-display text-4xl font-bold mb-2 text-center">your job hunt, but it's not your problem anymore</h2>
        <p className="text-fog text-center mb-10">four things happen. you do one of them.</p>
        <div className="grid md:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className={`bg-panel border border-edge rounded-2xl p-6 hover:border-mint transition ${i % 2 ? "md:translate-y-4" : ""}`}>
              <p className="text-3xl mb-3">{s.e}</p>
              <p className="font-display font-bold mb-2">{s.t}</p>
              <p className="text-fog text-sm leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative max-w-4xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {RECEIPTS.map(([n, d]) => (
            <div key={n} className="bg-panel border border-edge rounded-2xl p-6 text-center">
              <p className="font-display text-5xl font-bold text-mint mb-2">{n}</p>
              <p className="text-fog text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 pb-24">
        <div className="bg-panel border border-mint rounded-3xl p-10 text-center shadow-[0_0_80px_-20px_#3DFFA2]">
          <p className="text-3xl mb-4">👀</p>
          <h2 className="font-display text-3xl font-bold mb-3">"wait, it made a video of me pitching stripe?"</h2>
          <p className="text-fog mb-8">
            Yes. Your face, your voice, a 30-second pitch tailored to every company on a personal landing page the hiring manager actually opens.<br /> It's the thing that gets replies.</p>
          <Link href="/login" className="inline-block bg-mint text-ink font-bold text-lg px-10 py-4 rounded-full hover:bg-mintdim hover:scale-105 transition">okay i'm in →</Link>
        </div>
      </section>

      <footer className="relative border-t border-edge py-8 text-center text-fog/50 text-sm">
        gigaprowl. · the smartest job hunter in the world · <Link href="/pricing" className="hover:text-fog">pricing</Link>
      </footer>
    </div>
  );
}
