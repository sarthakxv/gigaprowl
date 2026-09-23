import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  FileCheck2,
  FileText,
  Mail,
  Menu,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { VIDEO_GENERATION_ENABLED } from "@/lib/constants";
import HeroPreviewMotion from "./HeroPreviewMotion";

export const metadata = {
  title: "Gigaprowl | Find better-fit work and make your case",
  description: "Turn your experience into credible job matches and material for applications or targeted outreach.",
};

const COMPANIES = [
  { name: "Linear", logo: "/assets/companies/linear.svg" },
  { name: "Vercel", logo: "/assets/companies/vercel.svg" },
  { name: "Stripe", logo: "/assets/companies/stripe.svg" },
  { name: "Notion", logo: "/assets/companies/notion.svg" },
  { name: "PostHog", logo: "/assets/companies/posthog.svg" },
  { name: "Figma", logo: "/assets/companies/figma.svg" },
];

const WORKFLOW = [
  {
    number: "01",
    title: "Build your profile",
    description: "Import your resume, check what Gigaprowl extracted, and set the roles and constraints that matter.",
    icon: FileText,
  },
  {
    number: "02",
    title: "Review credible matches",
    description: "See why each role fits, where the gaps are, and whether location and authorization line up.",
    icon: Search,
  },
  {
    number: "03",
    title: "Choose your next move",
    description: "Create an application kit or spend a Hunt credit on a targeted outreach campaign.",
    icon: Target,
  },
  {
    number: "04",
    title: "Approve every action",
    description: "Review the work and confirm the recipient before Gigaprowl creates a draft or queues a message.",
    icon: ShieldCheck,
  },
];

const MATCHES = [
  { company: "Linear", role: "Senior Product Engineer", score: 92, state: "Strong outreach candidate" },
  { company: "PostHog", role: "Product Engineer, Growth", score: 88, state: "Strong application fit" },
  { company: "Vercel", role: "Design Engineer", score: 84, state: "Good application fit" },
];

const CAMPAIGN_STEPS = [
  { label: "Contact", detail: "Maya Chen · VP Product", icon: UserRoundCheck, complete: true },
  { label: "Application kit", detail: "Ready for review", icon: FileCheck2, active: true },
  { label: "Private pitch", detail: "Draft", icon: FileText },
  { label: "Outreach", detail: "Not approved", icon: Mail },
];

function Brand() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg font-brand text-xl font-bold tracking-[-0.04em] text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
      <span className="grid size-9 place-items-center overflow-visible">
        <Image src="/prototype/v1/logo-vector.svg" alt="" width={46} height={46} className="size-11 max-w-none brightness-0" />
      </span>
      gigaprowl
    </Link>
  );
}

function PrimaryLink({ href, children, className = "" }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-5 py-3 text-sm font-bold text-brandon transition-colors duration-150 ease-out hover:bg-branddark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2", className)}
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children, className = "" }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-5 py-3 text-sm font-bold text-copy transition-colors duration-150 ease-out hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2", className)}
    >
      {children}
    </Link>
  );
}

function ProductPreview() {
  return (
    <HeroPreviewMotion className="mx-auto w-full max-w-[620px] lg:mx-0 lg:ml-auto">
      <div className="absolute -left-5 top-16 z-10 hidden w-36 rounded-lg border border-soft bg-surface p-4 shadow-[0_16px_36px_rgba(22,41,57,0.12)] xl:block" data-preview-step style={{ "--preview-delay": "400ms" }}>
        <span className="mb-3 grid size-9 place-items-center rounded-xl bg-raised text-brand"><Radar size={18} aria-hidden="true" /></span>
        <p className="text-xs font-semibold text-muted">First scan</p>
        <p className="mt-1 text-sm font-bold text-copy">18 credible matches</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-preview-border bg-preview-canvas p-2 shadow-[0_18px_48px_rgba(22,41,57,0.24)]" data-preview-step style={{ "--preview-delay": "80ms" }}>
        <div className="overflow-hidden rounded-lg bg-canvas">
          <div className="flex items-center justify-between border-b border-soft bg-surface px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand" />
              <span className="text-xs font-semibold text-muted">Opportunity workspace</span>
            </div>
            <span className="rounded-full border border-soft px-3 py-1 text-[11px] font-semibold text-muted">Synced 2m ago</span>
          </div>

          <div className="grid min-h-[480px] sm:grid-cols-[156px_minmax(0,1fr)]">
            <aside className="hidden border-r border-soft bg-nav p-4 sm:block">
              <div className="mb-8 flex items-center gap-2 font-brand text-sm font-bold tracking-[-0.04em]">
                <span className="grid size-7 place-items-center overflow-visible">
                  <Image src="/prototype/v1/logo-vector.svg" alt="" width={36} height={36} className="size-9 max-w-none brightness-0" />
                </span>
                gigaprowl
              </div>
              <nav className="space-y-1" aria-label="Product preview navigation">
                {[
                  [BriefcaseBusiness, "Opportunities"],
                  [Target, "Campaigns"],
                  [FileCheck2, "Application kits"],
                ].map(([Icon, label], index) => (
                  <div key={label} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold", index === 0 ? "bg-surface text-copy" : "text-muted")}>
                    <Icon size={14} aria-hidden="true" /> {label}
                  </div>
                ))}
              </nav>
              <div className="mt-36 rounded-md border border-soft bg-surface p-3">
                <p className="text-[10px] font-semibold text-muted">Hunt credits</p>
                <p className="mt-1 font-display text-2xl font-medium tabular-nums">3</p>
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-5">
              <span className="text-[10px] font-bold uppercase text-brand">Wednesday · September 10</span>
              <h2 className="mt-1 text-balance text-2xl font-semibold text-copy">Good afternoon, Sarthak</h2>
              <p className="mt-1 text-pretty text-xs text-muted">Gigaprowl found three new matches for you to review.</p>

              <div className="mt-5 flex items-center gap-2 rounded-[10px] border border-line bg-surface p-2.5" data-preview-step style={{ "--preview-delay": "160ms" }}>
                <Search size={15} className="text-muted" aria-hidden="true" />
                <span className="text-xs text-muted">Search role or company</span>
                <span className="ml-auto rounded-md bg-raised px-2 py-1 text-[10px] font-semibold text-muted">Fit</span>
              </div>

              <div className="mt-3 space-y-2">
                {MATCHES.map((match, index) => (
                  <article
                    key={match.company}
                    className={cn("rounded-md border bg-surface p-3", index === 0 ? "border-brand" : "border-soft")}
                    data-preview-step
                    style={{ "--preview-delay": `${220 + index * 80}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-raised font-display text-sm font-medium text-brand">{match.company[0]}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-xs font-bold text-copy">{match.role}</h3>
                        <p className="mt-0.5 text-[10px] text-muted">{match.company} · Remote</p>
                      </div>
                      <span className="grid size-9 place-items-center rounded-full border border-line text-xs font-bold text-brand tabular-nums">{match.score}</span>
                    </div>
                    {index === 0 && (
                      <div className="mt-3 border-t border-soft pt-2.5">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold text-brand"><Check size={12} aria-hidden="true" />{match.state}</p>
                        <p className="mt-1.5 text-[10px] text-muted">React systems, product ownership, and remote constraints align.</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-7 -right-3 hidden w-56 rounded-lg border border-soft bg-surface p-4 shadow-[0_16px_36px_rgba(22,41,57,0.12)] sm:block xl:-right-10" data-preview-step style={{ "--preview-delay": "520ms" }}>
        <p className="mb-3 flex items-center gap-2 text-xs font-bold text-copy"><Sparkles size={14} className="text-brand" aria-hidden="true" />Campaign ready to review</p>
        <div className="space-y-2">
          {CAMPAIGN_STEPS.slice(0, 3).map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-2 text-[10px] text-muted">
                <span className={cn("grid size-6 place-items-center rounded-full", step.complete ? "bg-brand text-brandon" : "bg-raised text-brand")}>
                  {step.complete ? <Check size={12} aria-hidden="true" /> : <Icon size={12} aria-hidden="true" />}
                </span>
                <span><strong className="block text-copy">{step.label}</strong>{step.detail}</span>
              </div>
            );
          })}
        </div>
      </div>
    </HeroPreviewMotion>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-hidden bg-canvas text-copy">
      <a href="#main-content" className="fixed left-4 top-[-80px] z-50 rounded-lg bg-brand px-4 py-3 font-semibold text-brandon focus:top-4">Skip to content</a>

      <header className="relative z-40 border-b border-soft bg-nav/95 backdrop-blur-md">
        <nav className="mx-auto flex min-h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-10" aria-label="Primary navigation">
          <Brand />
          <div className="hidden items-center gap-7 md:flex">
            <a href="#how-it-works" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-copy focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">How it works</a>
            <a href="#product" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-copy focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Product</a>
            <Link href="/scout" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-copy focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Scout</Link>
            <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-copy focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Pricing</Link>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/login?mode=login" className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-copy hover:text-brand focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Log in</Link>
            <PrimaryLink href="/login">Find my matches <ArrowRight size={16} aria-hidden="true" /></PrimaryLink>
          </div>
          <details className="group relative md:hidden">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[10px] border border-line bg-surface text-copy marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Open navigation menu">
              <Menu size={20} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-14 w-64 rounded-md border border-line bg-surface p-3 shadow-[0_16px_36px_rgba(22,41,57,0.24)]">
              <div className="grid">
                <a href="#how-it-works" className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-raised">How it works</a>
                <a href="#product" className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-raised">Product</a>
                <Link href="/scout" className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-raised">Scout</Link>
                <Link href="/pricing" className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-raised">Pricing</Link>
                <Link href="/login?mode=login" className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-raised">Log in</Link>
                <PrimaryLink href="/login" className="mt-2">Find my matches <ArrowRight size={16} aria-hidden="true" /></PrimaryLink>
              </div>
            </div>
          </details>
        </nav>
      </header>

      <main id="main-content">
        <section className="relative border-b border-soft px-4 py-16 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
            <div className="relative z-10">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-soft bg-surface px-3 py-1.5 text-xs font-bold text-brand">
                <span className="size-2 rounded-full bg-success" /> A review-first job search
              </p>
              <h1 className="max-w-2xl text-balance font-display text-[clamp(2.5rem,4vw,2.75rem)] font-medium leading-[1.06] tracking-[-0.035em] text-copy [overflow-wrap:anywhere]">
                Find work that fits and make your case to the right person.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-[15px] leading-[22px] text-muted">
                Gigaprowl turns your experience into credible job matches and material you can use in applications or targeted outreach.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <PrimaryLink href="/login" className="px-6">Find best matches <ArrowRight size={17} aria-hidden="true" /></PrimaryLink>
                <SecondaryLink href="/scout" className="px-6">Preview with Scout</SecondaryLink>
              </div>
              <div className="mt-5 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:gap-5">
                <span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-brand" aria-hidden="true" />No card required</span>
                <span className="flex items-center gap-2"><ShieldCheck size={17} className="text-brand" aria-hidden="true" />Nothing sent without your review</span>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="border-b border-soft bg-surface px-4 py-5 sm:px-6 lg:px-10" aria-label="Companies scanned by Gigaprowl">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 lg:flex-row lg:justify-between">
            <p className="text-center text-xs font-semibold text-muted lg:text-left">Scanning fresh roles across product-led teams</p>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 sm:gap-x-10">
              {COMPANIES.map((company) => (
                <span key={company.name} className="inline-flex items-center gap-2 text-sm font-semibold text-copy/60">
                  <Image src={company.logo} alt="" width={20} height={20} className="size-5 opacity-75" />
                  {company.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="px-4 py-16 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <span className="text-sm font-bold text-brand">From resume to action</span>
                <h2 className="mt-2 max-w-lg text-balance font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.03em]">Spend your time choosing which opportunities to pursue.</h2>
              </div>
              <p className="max-w-2xl text-pretty text-[15px] leading-[22px] text-muted lg:justify-self-end">
                Gigaprowl does the searching and first-draft work. You stay in charge of the facts, the opportunity, and every external action.
              </p>
            </div>

            <ol className="grid md:grid-cols-2 xl:grid-cols-4">
              {WORKFLOW.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.number} className={cn("relative border-line py-7 md:px-7 xl:min-h-[260px] xl:border-r", index % 2 === 0 && "md:border-r", index === 0 && "md:pl-0", index === WORKFLOW.length - 1 && "xl:border-r-0 xl:pr-0")}>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-medium text-brand tabular-nums">{step.number}</span>
                      <span className="grid size-11 place-items-center rounded-xl border border-soft bg-surface text-brand"><Icon size={20} aria-hidden="true" /></span>
                    </div>
                    <h3 className="mt-8 text-balance text-lg font-bold">{step.title}</h3>
                    <p className="mt-3 text-pretty text-sm leading-6 text-muted">{step.description}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="product" className="border-y border-soft bg-surface px-4 py-16 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-sm font-bold text-brand">Choose how to pursue each role</span>
              <h2 className="mt-2 text-balance font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.03em]">Build a focused application or prepare a targeted campaign.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-[15px] leading-[22px] text-muted">Apply with sharper material when the role is straightforward. Build a campaign when the right person needs to see your case.</p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-lg border border-line bg-canvas p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-raised text-brand"><FileCheck2 size={23} aria-hidden="true" /></span>
                  <span className="rounded-full border border-soft bg-surface px-3 py-1.5 text-xs font-bold text-muted">No Hunt credit</span>
                </div>
                <p className="mt-8 text-sm font-bold text-brand">Application kit</p>
                <h3 className="mt-2 text-balance font-display text-3xl font-medium leading-[1.1] tracking-[-0.025em]">Tailor your resume and case for the role.</h3>
                <p className="mt-4 text-pretty text-sm leading-6 text-muted">Get tailored resume guidance, a role-specific case, and the evidence behind the match. Review it before using it on the company’s application.</p>
                <ul className="mt-7 space-y-3 text-sm font-semibold text-copy">
                  {["Fit evidence and gaps", "Role-specific resume guidance with an editable narrative"].map((item) => <li key={item} className="flex items-center gap-2.5"><Check size={17} className="text-brand" aria-hidden="true" />{item}</li>)}
                </ul>
                <SecondaryLink href="/login" className="mt-9">Create an application kit <ArrowRight size={16} aria-hidden="true" /></SecondaryLink>
              </article>

              <article className="rounded-lg border border-preview-border bg-preview-canvas p-5 text-preview-text sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-lg bg-preview-surface text-preview-accent"><Target size={23} aria-hidden="true" /></span>
                  <span className="rounded-full border border-preview-border px-3 py-1.5 text-xs font-bold text-preview-muted">1 Hunt credit</span>
                </div>
                <p className="mt-8 text-sm font-bold text-preview-accent">Targeted campaign</p>
                <h3 className="mt-2 text-balance font-display text-3xl font-medium leading-[1.1] tracking-[-0.025em]">A complete case for one high-value opportunity.</h3>
                <p className="mt-4 text-pretty text-sm leading-6 text-preview-muted">Research the right contact and prepare a private pitch with an outreach sequence. You approve each publishing or delivery action.</p>
                <ul className="mt-7 space-y-3 text-sm font-semibold text-preview-text">
                  {["Contact research", "Private pitch with reviewable outreach drafts"].map((item) => <li key={item} className="flex items-center gap-2.5"><Check size={17} className="text-preview-accent" aria-hidden="true" />{item}</li>)}
                </ul>
                <Link href="/pricing" className="mt-9 inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-preview-accent px-5 py-3 text-sm font-bold text-preview-canvas transition-colors duration-150 ease-out hover:bg-[#8AC7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-preview-accent focus-visible:ring-offset-2 focus-visible:ring-offset-preview-canvas">See plans and credits <ArrowRight size={16} aria-hidden="true" /></Link>
              </article>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-brand"><ShieldCheck size={18} aria-hidden="true" />You approve each external action</span>
              <h2 className="mt-3 max-w-xl text-balance font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.03em]">Review the content and destination before Gigaprowl acts.</h2>
              <p className="mt-4 max-w-xl text-pretty text-[15px] leading-[22px] text-muted">Gigaprowl separates research and drafting from publishing and delivery. You inspect each result and approve external actions.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Editable claims", "Private by default", "Literal action labels", "Local retry and recovery"].map((item) => <span key={item} className="rounded-full border border-soft bg-surface px-3.5 py-2 text-xs font-bold text-muted">{item}</span>)}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4 sm:p-7">
              <div className="flex items-center justify-between border-b border-soft pb-5">
                <div>
                  <p className="text-xs font-bold text-brand">Campaign workspace</p>
                  <h3 className="mt-1 text-xl font-bold">Senior Product Engineer · Linear</h3>
                </div>
                <span className="hidden rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted sm:block">Needs review</span>
              </div>
              <ol className="mt-2">
                {CAMPAIGN_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-soft py-4 last:border-0">
                      <span className={cn("grid size-11 place-items-center rounded-xl", step.complete ? "bg-brand text-brandon" : "bg-raised text-brand")}>
                        {step.complete ? <Check size={19} aria-hidden="true" /> : <Icon size={19} aria-hidden="true" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-copy">{step.label}</p>
                        <p className="truncate text-sm text-muted">{step.detail}</p>
                      </div>
                      {step.active ? <span className="hidden items-center gap-1 text-xs font-bold text-brand sm:flex">Review <ChevronRight size={14} aria-hidden="true" /></span> : <Circle size={14} className="text-line" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 rounded-xl border border-soft bg-raised p-4 text-sm text-muted">
                <p className="flex items-start gap-2.5 text-pretty"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" /><span><strong className="text-copy">Gigaprowl has not sent or published anything.</strong> Review the required campaign steps to unlock those actions.</span></p>
              </div>
            </div>
          </div>
        </section>

        {VIDEO_GENERATION_ENABLED && (
          <section className="border-y border-soft bg-surface px-4 py-12 sm:px-6 lg:px-10">
            <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex max-w-3xl items-start gap-5">
                <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-raised text-brand sm:grid"><Video size={25} aria-hidden="true" /></span>
                <div>
                  <p className="text-sm font-bold text-brand">Optional video</p>
                  <h2 className="mt-2 text-balance font-display text-3xl font-medium leading-[1.1] tracking-[-0.025em]">Add video to a personal pitch when it helps your case.</h2>
                  <p className="mt-3 text-pretty text-sm leading-6 text-muted">You choose whether to set up your face and voice after Gigaprowl finds your opportunities. Consent stays separate from profile setup.</p>
                </div>
              </div>
              <SecondaryLink href="/login">Start with my profile <ArrowRight size={16} aria-hidden="true" /></SecondaryLink>
            </div>
          </section>
        )}

        <section className="px-4 py-16 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1000px] rounded-xl bg-brand px-6 py-12 text-center text-brandon sm:px-12 sm:py-16">
            <h2 className="mx-auto mt-5 max-w-3xl text-balance font-display text-[clamp(1.875rem,4vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.03em]">Spend your time reviewing credible opportunities.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-[15px] leading-[22px] text-white/80">Build your profile and choose which matches deserve a focused application or a full campaign.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-surface px-6 py-3 text-sm font-bold text-brand transition-colors duration-150 ease-out hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand">Find best matches <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link href="/scout" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-white/45 px-6 py-3 text-sm font-bold text-white transition-colors duration-150 ease-out hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand">Preview matches first</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-soft bg-nav px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Brand />
            <p className="mt-2 text-sm text-muted">Find credible roles and approve each next step.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-muted" aria-label="Footer navigation">
            <Link href="/scout" className="hover:text-copy">Scout</Link>
            <Link href="/pricing" className="hover:text-copy">Pricing</Link>
            <a href="mailto:hello@gigaprowl.com" className="hover:text-copy">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
