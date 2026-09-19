"use client";

// A throwaway Scout direction on the /prototype/v1/scout route.
// PROTOTYPE ONLY: scans, matches, and captured details are held in memory.

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileSearch,
  Globe2,
  Link2,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./scout.module.css";

const MATCHES = [
  {
    company: "Linear",
    initial: "L",
    role: "Senior Product Engineer",
    location: "Remote · India",
    age: "6 hours ago",
    score: 92,
    verdict: "Strong outreach candidate",
    salary: "$145k–$185k",
    evidence: "React systems, B2B product ownership, and design-system work align.",
    accent: "linear",
  },
  {
    company: "PostHog",
    initial: "P",
    role: "Product Engineer, Growth",
    location: "Remote · Global",
    age: "Yesterday",
    score: 88,
    verdict: "Strong application fit",
    salary: "$130k–$180k",
    evidence: "Full-stack TypeScript and growth experimentation are both explicit matches.",
    accent: "posthog",
  },
  {
    company: "Vercel",
    initial: "V",
    role: "Design Engineer",
    location: "Remote · APAC",
    age: "Yesterday",
    score: 84,
    verdict: "Good application fit",
    salary: "Salary not listed",
    evidence: "Frontend craft and developer-tool experience match; motion depth is unclear.",
    accent: "vercel",
  },
];

const SCAN_STEPS = [
  "Reading public profile signals",
  "Scanning 418 company career pages",
  "Checking roles posted in the last 48 hours",
  "Ranking fit with evidence",
];

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function ScoutPrototype() {
  const [phase, setPhase] = useState("idle");
  const [profileUrl, setProfileUrl] = useState("linkedin.com/in/sarthak-sharma");
  const [error, setError] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    if (phase !== "scanning") return undefined;
    setScanStep(0);
    const stepTimer = window.setInterval(() => {
      setScanStep((step) => Math.min(step + 1, SCAN_STEPS.length - 1));
    }, 650);
    const resultTimer = window.setTimeout(() => setPhase("results"), 2800);
    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(resultTimer);
    };
  }, [phase]);

  function runScan(event) {
    event?.preventDefault();
    if (!/linkedin\.com\/in\//i.test(profileUrl)) {
      setError("Paste a full LinkedIn profile URL so Scout knows who to match.");
      return;
    }
    setError("");
    setPhase("scanning");
  }

  function reset() {
    setError("");
    setScanStep(0);
    setPhase("idle");
  }

  const shared = { profileUrl, setProfileUrl, phase, scanStep, error, runScan, reset };

  return (
    <div className={classNames(styles.prototype, theme === "dark" && styles.darkTheme)}>
      <a className={styles.skipLink} href="#scout-main">Skip to Scout</a>
      <ScoutHeader theme={theme} setTheme={setTheme} reset={reset} />
      <main id="scout-main">
        <ScoutExperience {...shared} />
      </main>
    </div>
  );
}

function ScoutHeader({ theme, setTheme, reset }) {
  return (
    <header className={styles.siteHeader}>
      <button className={styles.brand} type="button" onClick={reset} aria-label="Reset Scout prototype">
        <span><img src="/prototype/v1/logo-vector.svg" alt="" width="44" height="44" /></span>
        <strong>gigaprowl</strong>
      </button>
      <div className={styles.productName}><span>Scout</span><i>Free</i></div>
      <nav aria-label="Scout navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#sample-matches">Sample matches</a>
        <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </nav>
    </header>
  );
}

function ScoutExperience(props) {
  if (props.phase === "scanning") return <ScanningState {...props} />;
  if (props.phase === "results") return <ResultsView {...props} />;

  return (
    <section className={styles.guidedPage}>
      <div className={styles.guidedHero}>
        <div className={styles.heroCopy}>
          <h1>paste your linkedin. <em>get matched in 60 seconds.</em></h1>
          <p>Scout reads your public LinkedIn profile, checks fresh roles across hundreds of company boards, and explains the fit. No account required.</p>
          <ScoutForm {...props} buttonLabel="Find my matches" />
          <TrustLine />
        </div>
        <aside className={styles.signalPanel} aria-label="Example Scout result">
          <div className={styles.signalHeader}><span>Live match preview</span><small><CircleDot size={12} /> refreshed 11m ago</small></div>
          <ProfileSignal />
          <div className={styles.signalConnector}><span /><small>418 boards checked</small><span /></div>
          <MiniMatch item={MATCHES[0]} primary />
          <MiniMatch item={MATCHES[1]} />
          <p className={styles.previewNote}><ShieldCheck size={14} /> Every score includes the evidence behind it.</p>
        </aside>
      </div>
      <HowItWorks />
    </section>
  );
}

function ScoutForm({ profileUrl, setProfileUrl, runScan, error, buttonLabel }) {
  return (
    <form className={styles.scoutForm} onSubmit={runScan}>
      <label>
        <span className={styles.srOnly}>LinkedIn profile URL</span>
        <Link2 size={19} />
        <input value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="linkedin.com/in/your-name" />
      </label>
      <button type="submit">{buttonLabel}<ArrowRight size={17} /></button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  );
}

function TrustLine() {
  return <p className={styles.trustLine}><ShieldCheck size={14} /> Free · no signup · no posting to LinkedIn</p>;
}

function ProfileSignal() {
  return (
    <div className={styles.profileSignal}>
      <span className={styles.avatar}>SS</span>
      <div><small>Profile understood</small><strong>Senior Product Engineer</strong><p>React · TypeScript · B2B systems</p></div>
      <BadgeCheck size={19} />
    </div>
  );
}

function MiniMatch({ item, primary = false }) {
  return (
    <article className={classNames(styles.miniMatch, primary && styles.miniMatchPrimary)}>
      <CompanyMark item={item} />
      <div><strong>{item.role}</strong><p>{item.company} · {item.location}</p></div>
      <span>{item.score}</span>
    </article>
  );
}

function CompanyMark({ item }) {
  return <span className={classNames(styles.companyMark, styles[item.accent])}>{item.initial}</span>;
}

function HowItWorks() {
  const steps = [
    { icon: FileSearch, title: "Read the signal", body: "Scout understands your role, seniority, skills, and positioning from a public profile." },
    { icon: Globe2, title: "Check the market", body: "Fresh openings are gathered directly from hundreds of company career pages." },
    { icon: Target, title: "Explain the fit", body: "The shortlist is ranked with evidence, gaps, constraints, and direct apply links." },
  ];
  return (
    <section className={styles.howItWorks} id="how-it-works">
      <header><span className={styles.eyebrow}>What happens under the hood</span><h2>A shortlist you can audit.</h2></header>
      <div>{steps.map(({ icon: Icon, title, body }, index) => <article key={title}><span>0{index + 1}</span><Icon size={21} /><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>
  );
}

function ScanningState({ scanStep }) {
  return (
    <section className={styles.scanningPage}>
      <div className={styles.radarGraphic} aria-hidden="true"><span className={styles.radarSweep} /><i /><i /><i /></div>
      <span className={styles.eyebrow}>Scan in progress</span>
      <h1>Separating plausible from worth your time.</h1>
      <div className={styles.scanSteps}>{SCAN_STEPS.map((step, index) => <p key={step} className={index === scanStep ? styles.scanActive : index < scanStep ? styles.scanDone : ""}>{index < scanStep ? <Check size={15} /> : <span>{index + 1}</span>}{step}</p>)}</div>
      <small>Prototype scan · results appear automatically</small>
    </section>
  );
}

function ResultsView({ reset }) {
  return (
    <section className={styles.resultsPage}>
      <header className={styles.resultsHeader}>
        <div><span className={styles.eyebrow}><CheckCircle2 size={15} />418 boards checked</span><h1>Three roles to act on today.</h1><p>Ranked for Sarthak Sharma · Senior Product Engineer · refreshed just now</p></div>
        <button className={styles.secondaryButton} type="button" onClick={reset}><RotateCcw size={16} /> Scan another profile</button>
      </header>
      <div className={styles.resultsLayout}>
        <div className={styles.matchList}>{MATCHES.map((item, index) => <ResultCard key={item.company} item={item} rank={index + 1} />)}</div>
        <aside className={styles.resultSummary}>
          <span className={styles.eyebrow}>Scout's read</span>
          <h2>Your strongest signal is product-minded frontend ownership.</h2>
          <p>Roles that combine interface craft with end-to-end product responsibility consistently ranked highest.</p>
          <div><span><Check size={15} /> Remote constraint respected</span><span><Check size={15} /> All roles posted within 48h</span><span><Check size={15} /> No duplicate listings</span></div>
          <button className={styles.primaryButton} type="button">Email this brief <ArrowRight size={16} /></button>
          <small>Optional · your report is already unlocked</small>
        </aside>
      </div>
    </section>
  );
}

function ResultCard({ item, rank }) {
  return (
    <article className={styles.resultCard}>
      <span className={styles.rank}>0{rank}</span>
      <CompanyMark item={item} />
      <div className={styles.resultIdentity}><span>{item.verdict}</span><h2>{item.role}</h2><p>{item.company} · {item.location}</p><small><Clock3 size={13} /> {item.age}<i />{item.salary}</small></div>
      <div className={styles.resultEvidence}><strong>{item.score}<small>/100</small></strong><p>{item.evidence}</p></div>
      <button type="button" aria-label={`Open ${item.role} at ${item.company}`}><ArrowUpRight size={19} /></button>
    </article>
  );
}
