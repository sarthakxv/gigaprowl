"use client";

// Three variants of the v1 end-to-end product flow, switchable via ?variant=.
// PROTOTYPE ONLY: every value and interaction on this route is held in memory.

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Command,
  ExternalLink,
  FileCheck2,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  PenLine,
  Play,
  Plus,
  Radar,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./prototype.module.css";

const VARIANTS = [
  { key: "A", name: "Focus queue" },
  { key: "B", name: "Editorial workspace" },
  { key: "C", name: "Progress cockpit" },
];

const NAV = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { id: "campaigns", label: "Campaigns", icon: Target },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

const opportunities = [
  {
    id: "linear",
    role: "Senior Product Engineer",
    company: "Linear",
    location: "Remote · India",
    age: "6 hours ago",
    fit: "Strong outreach candidate",
    score: 92,
    salary: "$145k–$185k",
    evidence: ["React systems and product ownership", "5+ years shipping B2B software"],
    gap: "No explicit GraphQL production example",
    constraint: "Remote and authorization preferences align",
    accent: "linear",
  },
  {
    id: "vercel",
    role: "Design Engineer",
    company: "Vercel",
    location: "Remote · APAC",
    age: "Yesterday",
    fit: "Good application fit",
    score: 84,
    salary: "Not listed",
    evidence: ["Strong frontend craft and prototyping", "Developer-tool experience"],
    gap: "Role may expect deeper motion work",
    constraint: "Remote preference aligns · authorization unknown",
    accent: "vercel",
  },
  {
    id: "posthog",
    role: "Product Engineer, Growth",
    company: "PostHog",
    location: "Remote · Global",
    age: "2 days ago",
    fit: "Strong application fit",
    score: 88,
    salary: "$130k–$180k",
    evidence: ["Growth experimentation experience", "Full-stack TypeScript ownership"],
    gap: "Limited public writing samples",
    constraint: "All required constraints align",
    accent: "posthog",
  },
  {
    id: "stripe",
    role: "Frontend Engineer",
    company: "Stripe",
    location: "Bengaluru · Hybrid",
    age: "4 days ago",
    fit: "Low confidence",
    score: 68,
    salary: "Not listed",
    evidence: ["Relevant design-system work", "Fintech domain overlap"],
    gap: "Required office cadence is unclear",
    constraint: "Location aligns · hybrid constraint unknown",
    accent: "stripe",
  },
];

const initialCampaign = {
  status: "needs review",
  reviewed: ["contact"],
  pitchPublished: false,
  delivery: "draft",
  activeSection: "kit",
  paused: false,
};

const campaignSteps = [
  { id: "contact", label: "Contact", detail: "Maya Chen · VP Product", icon: UserRoundCheck },
  { id: "kit", label: "Application kit", detail: "Needs review", icon: FileCheck2 },
  { id: "pitch", label: "Pitch page", detail: "Private draft", icon: FileText },
  { id: "video", label: "Video / script", detail: "Optional", icon: Video },
  { id: "outreach", label: "Outreach steps", detail: "0 of 3 approved", icon: Mail },
  { id: "social", label: "Social draft", detail: "Not added", icon: MessageSquareText },
];

const requiredCampaignSteps = ["contact", "kit", "pitch", "outreach"];

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function PrototypeApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawVariant = (searchParams.get("variant") || "A").toUpperCase();
  const variant = VARIANTS.some((item) => item.key === rawVariant) ? rawVariant : "A";
  const [view, setView] = useState("today");
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [campaign, setCampaign] = useState(initialCampaign);
  const [credits, setCredits] = useState(3);
  const [saved, setSaved] = useState(["linear"]);
  const [dismissed, setDismissed] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentOpportunity = selectedOpportunity
    ? opportunities.find((item) => item.id === selectedOpportunity)
    : null;

  const mockState = useMemo(
    () => ({
      variant,
      view: currentOpportunity ? `opportunity:${currentOpportunity.id}` : view,
      huntCredits: credits,
      savedOpportunityIds: saved,
      dismissedOpportunityIds: dismissed,
      campaign,
    }),
    [campaign, credits, currentOpportunity, dismissed, saved, variant, view],
  );

  function setVariant(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setStateOpen(true);
  }

  function cycleVariant(direction) {
    const index = VARIANTS.findIndex((item) => item.key === variant);
    const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
    setVariant(next.key);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target?.isContentEditable) return;
      if (event.key === "ArrowLeft") cycleVariant(-1);
      if (event.key === "ArrowRight") cycleVariant(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function navigate(next) {
    setSelectedOpportunity(null);
    setView(next);
    setMenuOpen(false);
  }

  function showMock(message) {
    setToast(message);
  }

  function openOpportunity(id) {
    setSelectedOpportunity(id);
    setView("opportunities");
  }

  function toggleSave(id) {
    setSaved((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
    setToast(saved.includes(id) ? "Removed from saved opportunities" : "Opportunity saved");
  }

  function dismissOpportunity(id) {
    setDismissed((items) => [...items, id]);
    setToast("Opportunity dismissed · Undo available in this mock session");
  }

  function undoDismiss() {
    setDismissed((items) => items.slice(0, -1));
    setToast("Opportunity restored");
  }

  function startCampaign() {
    setDialog({ type: "campaign", opportunity: currentOpportunity || opportunities[0] });
  }

  function confirmCampaign() {
    setCredits((value) => Math.max(0, value - 1));
    setCampaign(initialCampaign);
    setSelectedOpportunity(null);
    setView("campaigns");
    setDialog(null);
    setToast("Campaign created — nothing published or sent");
  }

  function reviewSection(section) {
    setCampaign((value) => ({
      ...value,
      reviewed: value.reviewed.includes(section) ? value.reviewed : [...value.reviewed, section],
    }));
    setToast(`${campaignSteps.find((step) => step.id === section)?.label || "Asset"} marked reviewed`);
  }

  function publishPitch() {
    setCampaign((value) => ({ ...value, pitchPublished: true, reviewed: [...new Set([...value.reviewed, "pitch"])] }));
    setDialog(null);
    setToast("Pitch published by private link");
  }

  function createDraft() {
    setCampaign((value) => ({ ...value, delivery: "Gmail draft created", reviewed: [...new Set([...value.reviewed, "outreach"])] }));
    setDialog(null);
    setToast("Mock Gmail draft created — no provider was contacted");
  }

  const sharedProps = {
    view,
    menuOpen,
    setMenuOpen,
    navigate,
    currentOpportunity,
    openOpportunity,
    setSelectedOpportunity,
    selectedOpportunity,
    campaign,
    setCampaign,
    credits,
    saved,
    dismissed,
    toggleSave,
    dismissOpportunity,
    undoDismiss,
    startCampaign,
    setDialog,
    reviewSection,
    showMock,
  };

  return (
    <div className={classNames(styles.prototype, styles[`variant${variant}`])}>
      <a className={styles.skipLink} href="#prototype-main">Skip to main content</a>
      <div className={styles.prototypeFlag}><Sparkles size={14} /> UX prototype · Mock data only</div>

      {variant === "A" && <VariantA {...sharedProps} />}
      {variant === "B" && <VariantB {...sharedProps} />}
      {variant === "C" && <VariantC {...sharedProps} />}

      {dialog?.type === "campaign" && (
        <Modal title="Create outreach campaign?" eyebrow="1 Hunt credit" onClose={() => setDialog(null)}>
          <p className={styles.modalLead}>
            Create a reviewable campaign for <strong>{dialog.opportunity.role} at {dialog.opportunity.company}</strong>.
          </p>
          <div className={styles.receipt}>
            <ReceiptRow label="Application kit" value="Included" />
            <ReceiptRow label="Contact research" value="Included" />
            <ReceiptRow label="Private pitch draft" value="Included" />
            <ReceiptRow label="Three-message sequence" value="Included" />
            <ReceiptRow label="Cost now" value="1 Hunt credit" strong />
          </div>
          <div className={styles.safetyNote}>
            <ShieldCheck size={19} />
            <span>This only generates drafts. Nothing will be published, scheduled, or sent.</span>
          </div>
          <div className={styles.modalActions}>
            <Button tone="secondary" onClick={() => setDialog(null)}>Keep reviewing</Button>
            <Button onClick={confirmCampaign}>Use 1 credit and create</Button>
          </div>
        </Modal>
      )}

      {dialog?.type === "publish" && (
        <Modal title="Publish this pitch page?" eyebrow="Privacy checkpoint" onClose={() => setDialog(null)}>
          <div className={styles.pitchPreview}>
            <span>Private preview</span>
            <h3>Sarthak × Linear</h3>
            <p>A concise case for why this product-engineering match is worth a conversation.</p>
          </div>
          <p className={styles.modalLead}>Anyone with the generated link will be able to view the page. You can unpublish it at any time.</p>
          <div className={styles.modalActions}>
            <Button tone="secondary" onClick={() => setDialog(null)}>Keep private</Button>
            <Button onClick={publishPitch}>Publish pitch by link</Button>
          </div>
        </Modal>
      )}

      {dialog?.type === "delivery" && (
        <Modal title="Create this Gmail draft?" eyebrow="Approve one action" onClose={() => setDialog(null)}>
          <div className={styles.approvalGrid}>
            <ReceiptRow label="Recipient" value="Maya Chen · VP Product" />
            <ReceiptRow label="From" value="sarthak@gmail.com" />
            <ReceiptRow label="Channel" value="Gmail draft" />
            <ReceiptRow label="Timing" value="Create now · you send later" />
          </div>
          <div className={styles.messagePreview}>
            <span>Subject · Product engineering at Linear</span>
            <p>Hi Maya — I’ve spent the last few years turning ambiguous product problems into fast, careful software...</p>
          </div>
          <div className={styles.safetyNote}>
            <ShieldCheck size={19} />
            <span>Approval applies only to this draft. Editing it will require a new approval.</span>
          </div>
          <div className={styles.modalActions}>
            <Button tone="secondary" onClick={() => setDialog(null)}>Edit message</Button>
            <Button onClick={createDraft}>Create Gmail draft</Button>
          </div>
        </Modal>
      )}

      {dialog?.type === "deliveryReceipt" && (
        <Modal title="Gmail draft receipt" eyebrow="Mock provider result" onClose={() => setDialog(null)}>
          <div className={styles.receipt}>
            <ReceiptRow label="Status" value="Draft created" />
            <ReceiptRow label="Recipient" value="Maya Chen · VP Product" />
            <ReceiptRow label="Account" value="sarthak@gmail.com" />
            <ReceiptRow label="Recorded" value="Today · just now" />
          </div>
          <div className={styles.safetyNote}>
            <ShieldCheck size={19} />
            <span>This is a prototype receipt. No provider was contacted and no email was sent.</span>
          </div>
          <div className={styles.modalActions}>
            <Button onClick={() => setDialog(null)}>Done</Button>
          </div>
        </Modal>
      )}

      {toast && <div className={styles.toast} role="status"><CheckCircle2 size={18} /> {toast}</div>}

      <button className={styles.stateButton} type="button" onClick={() => setStateOpen((value) => !value)}>
        <Command size={15} /> Mock state
      </button>
      {stateOpen && (
        <aside className={styles.statePanel} aria-label="Current prototype state">
          <div><strong>Current in-memory state</strong><button type="button" onClick={() => setStateOpen(false)}><X size={16} /></button></div>
          <pre>{JSON.stringify(mockState, null, 2)}</pre>
        </aside>
      )}

      {process.env.NODE_ENV !== "production" && (
        <PrototypeSwitcher current={variant} onCycle={cycleVariant} />
      )}
    </div>
  );
}

function VariantA(props) {
  return (
    <div className={styles.shellA}>
      <SideNav {...props} />
      <main id="prototype-main" className={styles.mainA}>
        <TopContext credits={props.credits} compact />
        <RouteContent {...props} variant="A" />
      </main>
      <MobileNav {...props} />
    </div>
  );
}

function VariantB(props) {
  return (
    <div className={styles.shellB}>
      <header className={styles.topNavB}>
        <Brand />
        <nav aria-label="Primary navigation">
          {NAV.map((item) => <NavButton key={item.id} item={item} active={props.view === item.id} onClick={() => props.navigate(item.id)} />)}
        </nav>
        <TopContext credits={props.credits} compact />
      </header>
      <main id="prototype-main" className={styles.mainB}>
        <RouteContent {...props} variant="B" />
      </main>
      <MobileNav {...props} />
    </div>
  );
}

function VariantC(props) {
  return (
    <div className={styles.shellC}>
      <header className={styles.mobileHeaderC}>
        <Brand />
        <button type="button" onClick={() => props.setMenuOpen(!props.menuOpen)}><Menu /></button>
      </header>
      <aside className={classNames(styles.railC, props.menuOpen && styles.railOpen)}>
        <Brand compact />
        <nav aria-label="Primary navigation">
          {NAV.map((item) => <NavButton key={item.id} item={item} active={props.view === item.id} onClick={() => props.navigate(item.id)} iconOnly />)}
        </nav>
        <div className={styles.avatar}>SX</div>
      </aside>
      <main id="prototype-main" className={styles.mainC}>
        <div className={styles.cockpitHeader}>
          <div><span>September 10 · Wednesday</span><strong>Your search is moving</strong></div>
          <TopContext credits={props.credits} />
        </div>
        <RouteContent {...props} variant="C" />
      </main>
      <MobileNav {...props} />
    </div>
  );
}

function RouteContent(props) {
  if (props.currentOpportunity) return <OpportunityDetail {...props} opportunity={props.currentOpportunity} />;
  if (props.view === "opportunities") return <Opportunities {...props} />;
  if (props.view === "campaigns") return <CampaignWorkspace {...props} />;
  if (props.view === "activity") return <ActivityView {...props} />;
  if (props.view === "settings") return <SettingsView {...props} />;
  return <Today {...props} />;
}

function SideNav({ view, navigate, credits }) {
  return (
    <aside className={styles.sideNavA}>
      <Brand />
      <nav aria-label="Primary navigation">
        {NAV.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />)}
      </nav>
      <div className={styles.creditCard}>
        <span><Zap size={16} /> Hunt credits</span>
        <strong>{credits}</strong>
        <small>Renews October 1</small>
      </div>
      <button className={styles.accountButton} type="button"><span className={styles.avatar}>SX</span><span>Sarthak<br /><small>View account</small></span><MoreHorizontal size={18} /></button>
    </aside>
  );
}

function Brand({ compact = false }) {
  return <div className={styles.brand}><span><Radar size={compact ? 20 : 22} /></span>{!compact && <strong>gigaprowl</strong>}</div>;
}

function NavButton({ item, active, onClick, iconOnly = false }) {
  const Icon = item.icon;
  return (
    <button className={classNames(styles.navButton, active && styles.navActive)} type="button" onClick={onClick} aria-current={active ? "page" : undefined} aria-label={iconOnly ? item.label : undefined}>
      <Icon size={19} /> {!iconOnly && <span>{item.label}</span>}
      {item.id === "today" && !iconOnly && <span className={styles.navCount}>4</span>}
    </button>
  );
}

function MobileNav({ view, navigate }) {
  return (
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      {NAV.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} type="button" className={view === item.id ? styles.mobileActive : ""} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span></button>;
      })}
    </nav>
  );
}

function TopContext({ credits, compact = false }) {
  return (
    <div className={classNames(styles.topContext, compact && styles.topContextCompact)}>
      <span className={styles.syncState}><span /> Synced 2m ago</span>
      <span className={styles.topCredits}><Zap size={15} /> {credits} credits</span>
      <button className={styles.avatar} type="button" aria-label="Open account menu">SX</button>
    </div>
  );
}

function Today(props) {
  const visibleOpportunities = opportunities.filter((item) => !props.dismissed.includes(item.id));
  return (
    <section className={styles.route}>
      <PageHeader eyebrow="Wednesday · September 10" title="Good afternoon, Sarthak" description="Four things need your attention. Start with the decision that blocks everything else." />

      <div className={styles.priorityAlert}>
        <div className={styles.alertIcon}><AlertTriangle size={21} /></div>
        <div><span>Safety check</span><strong>LinkedIn delivery needs confirmation</strong><p>A connection request to Notion has an uncertain provider status. Check it before retrying.</p></div>
        <Button tone="warning" onClick={() => props.showMock("Mock recovery opened · no provider contacted")}>Reconcile delivery</Button>
      </div>

      <div className={styles.todayGrid}>
        <section className={styles.queueSection}>
          <SectionHeading kicker="First up" title="Needs your review" count="2" />
          <ActionCard
            marker="01"
            label="Campaign asset"
            title="Review application kit"
            company="Senior Product Engineer · Linear"
            meta="Generated from profile v4 · 8 min read"
            action="Review kit"
            onClick={() => props.navigate("campaigns")}
          />
          <ActionCard
            marker="02"
            label="Due today"
            title="Approve or edit first outreach"
            company="Product Designer · Raycast"
            meta="Gmail draft · Maya Patel · due 4:30 PM"
            action="Review message"
            onClick={() => props.setDialog({ type: "delivery" })}
          />
        </section>

        <aside className={styles.todayAside}>
          <section>
            <SectionHeading kicker="New since yesterday" title="Fresh matches" count="3" />
            {visibleOpportunities.slice(0, 3).map((item) => (
              <CompactOpportunity key={item.id} item={item} onClick={() => props.openOpportunity(item.id)} />
            ))}
            <button className={styles.textLink} type="button" onClick={() => props.navigate("opportunities")}>See all opportunities <ArrowRight size={16} /></button>
          </section>
          <ProgressCard variant={props.variant} />
        </aside>
      </div>
    </section>
  );
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className={styles.pageHeader}>
      <div>{eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action}
    </header>
  );
}

function SectionHeading({ kicker, title, count }) {
  return <header className={styles.sectionHeading}><div>{kicker && <span>{kicker}</span>}<h2>{title}</h2></div>{count && <strong>{count}</strong>}</header>;
}

function ActionCard({ marker, label, title, company, meta, action, onClick }) {
  return (
    <article className={styles.actionCard}>
      <span className={styles.actionMarker}>{marker}</span>
      <div className={styles.actionBody}><span>{label}</span><h3>{title}</h3><p>{company}</p><small>{meta}</small></div>
      <Button onClick={onClick}>{action}<ArrowRight size={17} /></Button>
    </article>
  );
}

function CompactOpportunity({ item, onClick }) {
  return (
    <button className={styles.compactOpportunity} type="button" onClick={onClick}>
      <CompanyMark item={item} />
      <span><strong>{item.role}</strong><small>{item.company} · {item.age}</small></span>
      <span className={styles.score}>{item.score}</span>
    </button>
  );
}

function ProgressCard() {
  return (
    <section className={styles.progressCard}>
      <div className={styles.progressRing}><span>6</span><small>active</small></div>
      <div><span>This month</span><h3>Momentum, not volume</h3><p>3 applications · 2 replies · 1 interview</p><div className={styles.sparkBars}>{[30, 45, 36, 64, 54, 78, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
    </section>
  );
}

function Opportunities(props) {
  const visible = opportunities.filter((item) => !props.dismissed.includes(item.id));
  return (
    <section className={styles.route}>
      <PageHeader
        eyebrow="18 credible matches"
        title="Opportunities"
        description="Decide which roles deserve your time. Fit recommendations show their evidence."
        action={<Button onClick={() => props.showMock("Mock refresh queued · existing matches preserved")}><RotateCcw size={17} /> Refresh opportunities</Button>}
      />
      <div className={styles.filters}>
        <label className={styles.searchField}><Search size={18} /><span className={styles.srOnly}>Search opportunities</span><input placeholder="Search role or company" /></label>
        {["Freshness", "Location", "Fit", "State"].map((label) => <button className={styles.desktopFilter} key={label} type="button" onClick={() => props.showMock(`${label} filter menu opened`)}>{label}<ChevronDown size={15} /></button>)}
        <button className={styles.mobileFilter} type="button" onClick={() => props.showMock("All filters sheet opened · 4 groups available")}>Filters 4 <ChevronDown size={15} /></button>
        <span>Last scan 2h ago</span>
      </div>
      <div className={styles.opportunityList}>
        {visible.map((item) => (
          <OpportunityCard
            key={item.id}
            item={item}
            saved={props.saved.includes(item.id)}
            onOpen={() => props.openOpportunity(item.id)}
            onSave={() => props.toggleSave(item.id)}
            onDismiss={() => props.dismissOpportunity(item.id)}
          />
        ))}
      </div>
      {props.dismissed.length > 0 && <button className={styles.undoBar} type="button" onClick={props.undoDismiss}>1 opportunity dismissed <span>Undo</span></button>}
    </section>
  );
}

function OpportunityCard({ item, saved, onOpen, onSave, onDismiss }) {
  return (
    <article className={styles.opportunityCard}>
      <div className={styles.opportunityIdentity}>
        <CompanyMark item={item} />
        <div><button type="button" onClick={onOpen}><h2>{item.role}</h2></button><p>{item.company} · {item.location}</p><span>{item.age} · {item.salary}</span></div>
      </div>
      <div className={styles.fitCell}><span className={styles.fitLabel}>{item.fit}</span><strong>{item.score}<small>/100</small></strong></div>
      <div className={styles.evidenceCell}>{item.evidence.map((evidence) => <span key={evidence}><Check size={15} />{evidence}</span>)}<span className={styles.constraint}><ShieldCheck size={15} />{item.constraint}</span></div>
      <div className={styles.cardActions}><Button tone="ghost" onClick={onSave}>{saved ? "Saved" : "Save"}</Button><Button tone="ghost" onClick={onDismiss}>Dismiss</Button><Button onClick={onOpen}>Open <ArrowRight size={16} /></Button></div>
    </article>
  );
}

function CompanyMark({ item }) {
  return <span className={classNames(styles.companyMark, styles[item.accent])}>{item.company.slice(0, 1)}</span>;
}

function OpportunityDetail(props) {
  const { opportunity } = props;
  return (
    <section className={styles.route}>
      <button className={styles.backButton} type="button" onClick={() => props.setSelectedOpportunity(null)}><ArrowLeft size={17} /> Opportunities</button>
      <header className={styles.detailHeader}>
        <CompanyMark item={opportunity} />
        <div><span>{opportunity.fit} · {opportunity.score}/100</span><h1>{opportunity.role}</h1><p>{opportunity.company} · {opportunity.location} · Full-time</p></div>
        <div className={styles.detailBadges}><span>Saved</span><span>Fresh</span><button type="button" aria-label="More actions"><MoreHorizontal /></button></div>
      </header>
      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.fitPanel}>
            <span className={styles.eyebrow}>Why this is worth your time</span>
            <h2>Your product instincts and frontend depth line up unusually well.</h2>
            <div className={styles.evidenceGrid}>
              <div><strong>Aligned evidence</strong>{opportunity.evidence.map((item) => <p key={item}><CheckCircle2 size={17} />{item}</p>)}</div>
              <div><strong>Worth checking</strong><p><AlertTriangle size={17} />{opportunity.gap}</p><p><Circle size={17} />Compensation fit is still unknown</p></div>
            </div>
          </section>
          <section className={styles.detailSection}><h2>Required constraints</h2><div className={styles.constraintRows}><span><MapPin size={17} />Remote preference<strong>Aligned</strong></span><span><ShieldCheck size={17} />Work authorization<strong>Aligned</strong></span><span><Gauge size={17} />Seniority<strong>Aligned</strong></span></div></section>
          <section className={styles.detailSection}><h2>About the role</h2><p>Own meaningful product areas from first sketch to reliable implementation. Work closely with design, write clear technical plans, and improve the systems that let a small team move quickly.</p><button className={styles.textLink} type="button">Read full job description <ExternalLink size={15} /></button></section>
        </div>
        <aside className={styles.decisionRail}>
          <span className={styles.eyebrow}>Recommended next step</span>
          <h2>Make this one personal.</h2>
          <p>The fit and likely contact path justify focused outreach.</p>
          <Button onClick={props.startCampaign}><Target size={17} /> Start outreach campaign</Button>
          <small>Uses 1 Hunt credit after confirmation.</small>
          <div className={styles.or}><span />or<span /></div>
          <Button tone="secondary" onClick={() => props.showMock("Application kit generation preview opened")}><FileCheck2 size={17} /> Create application kit</Button>
          <small>Editable material only. Gigaprowl never submits.</small>
          <div className={styles.railLinks}><button type="button" onClick={() => props.toggleSave(opportunity.id)}>Save for later</button><button type="button" onClick={() => props.dismissOpportunity(opportunity.id)}>Dismiss role</button></div>
        </aside>
      </div>
    </section>
  );
}

function CampaignWorkspace(props) {
  const activeStep = campaignSteps.find((step) => step.id === props.campaign.activeSection);
  const reviewedRequiredCount = requiredCampaignSteps.filter((step) => props.campaign.reviewed.includes(step)).length;
  const nextStep = requiredCampaignSteps.find((step) => !props.campaign.reviewed.includes(step));
  const nextAction = nextStep
    ? `Review ${campaignSteps.find((step) => step.id === nextStep).label.toLowerCase()}`
    : "All required assets reviewed";
  const campaignStatus = props.campaign.paused
    ? "Paused"
    : reviewedRequiredCount === requiredCampaignSteps.length
      ? "Ready"
      : "Needs review";

  function getStepDetail(step) {
    if (step.id === "contact" && props.campaign.reviewed.includes(step.id)) return "Confirmed";
    if (step.id === "pitch" && props.campaign.pitchPublished) return "Published by link";
    if (step.id === "pitch" && props.campaign.reviewed.includes(step.id)) return "Reviewed · private";
    if (step.id === "outreach" && props.campaign.delivery !== "draft") return props.campaign.delivery;
    if (props.campaign.reviewed.includes(step.id)) return "Reviewed";
    return step.detail;
  }

  return (
    <section className={styles.route}>
      <button className={styles.backButton} type="button">← Campaigns</button>
      <header className={styles.campaignHeader}>
        <div><span className={styles.eyebrow}>Senior Product Engineer · Linear</span><h1>Campaign workspace</h1><p>Next action: {nextAction}</p></div>
        <div><span className={styles.statusBadge}>{campaignStatus}</span><Button tone="secondary" onClick={() => props.setCampaign((value) => ({ ...value, paused: !value.paused }))}>{props.campaign.paused ? <Play size={16} /> : <Pause size={16} />}{props.campaign.paused ? "Resume" : "Pause"}</Button></div>
      </header>
      <div className={styles.campaignProgress}><span style={{ width: `${reviewedRequiredCount * 25}%` }} /><small>{reviewedRequiredCount} of {requiredCampaignSteps.length} required assets reviewed</small></div>
      <div className={styles.workspaceGrid}>
        <nav className={styles.checklist} aria-label="Campaign sections">
          <span className={styles.eyebrow}>Campaign checklist</span>
          {campaignSteps.map((step, index) => {
            const Icon = step.icon;
            const reviewed = props.campaign.reviewed.includes(step.id) || (step.id === "pitch" && props.campaign.pitchPublished);
            return (
              <button key={step.id} type="button" className={props.campaign.activeSection === step.id ? styles.stepActive : ""} onClick={() => props.setCampaign((value) => ({ ...value, activeSection: step.id }))}>
                <span>{reviewed ? <Check size={15} /> : index + 1}</span><Icon size={18} /><span><strong>{step.label}</strong><small>{getStepDetail(step)}</small></span><ArrowRight size={16} />
              </button>
            );
          })}
        </nav>
        <div className={styles.editorArea}>
          <AssetEditor step={activeStep} campaign={props.campaign} setCampaign={props.setCampaign} setDialog={props.setDialog} onReview={() => props.reviewSection(activeStep.id)} />
        </div>
        <aside className={styles.contextRail}>
          <span className={styles.eyebrow}>Opportunity context</span>
          <h3>Strong outreach candidate</h3>
          <p>92/100 · Remote and authorization preferences align.</p>
          <div className={styles.contactMini}><span className={styles.avatar}>MC</span><span><strong>Maya Chen</strong><small>VP Product · Verified</small></span></div>
          <div className={styles.receiptMini}><ReceiptRow label="Credit used" value="1" /><ReceiptRow label="Created" value="Today, 2:14 PM" /><ReceiptRow label="Profile" value="Version 4" /></div>
          <button className={styles.textLink} type="button">View campaign timeline <ArrowRight size={15} /></button>
        </aside>
      </div>
    </section>
  );
}

function AssetEditor({ step, campaign, setCampaign, setDialog, onReview }) {
  if (step.id === "contact") {
    return <EditorFrame title="Confirm your contact" description="This person appears close enough to the role to make the message relevant."><div className={styles.contactHero}><span className={styles.avatar}>MC</span><div><h3>Maya Chen</h3><p>VP Product · Linear</p><span><ShieldCheck size={15} /> Verified work email · High confidence</span></div></div><div className={styles.sourceBox}><strong>Why Maya</strong><p>Owns the product organization this role joins and has posted about hiring senior product engineers.</p><small>Sources: company leadership page · public LinkedIn profile</small></div><div className={styles.editorActions}><Button tone="secondary">Replace contact</Button><Button onClick={onReview}>Confirm contact</Button></div></EditorFrame>;
  }
  if (step.id === "pitch") {
    return <EditorFrame title="Shape the pitch page" description={campaign.pitchPublished ? "Published by link · anyone with the URL can view it." : "Private draft · only you can view it."}><div className={styles.pitchPreviewLarge}><span>SARTHAK × LINEAR</span><h3>Building calm, fast products for teams with high standards.</h3><p>Three relevant projects, one short case study, and a personal note for the Linear team.</p><button type="button">Preview full page <ExternalLink size={15} /></button></div><div className={styles.editorActions}><Button tone="secondary"><PenLine size={16} /> Edit pitch</Button>{campaign.pitchPublished ? <Button tone="secondary" onClick={() => setCampaign((value) => ({ ...value, pitchPublished: false }))}>Unpublish</Button> : <Button onClick={() => setDialog({ type: "publish" })}>Publish pitch by link</Button>}</div></EditorFrame>;
  }
  if (step.id === "outreach") {
    return <EditorFrame title="Review outreach steps" description="Each action needs its own approval. Defaults never authorize a future send."><div className={styles.deliveryCard}><div><span className={styles.stepNumber}>1</span><span><strong>Intro email to Maya</strong><small>Gmail draft · Due today</small></span><span className={styles.statusBadge}>{campaign.delivery}</span></div><p>Hi Maya — I’ve spent the last few years turning ambiguous product problems into fast, careful software...</p><Button onClick={() => setDialog({ type: campaign.delivery === "draft" ? "delivery" : "deliveryReceipt" })}>{campaign.delivery === "draft" ? "Review and approve" : "Open draft receipt"}</Button></div><div className={styles.deliveryCard}><div><span className={styles.stepNumber}>2</span><span><strong>LinkedIn follow-up</strong><small>Suggested 3 days after email</small></span><span className={styles.statusBadge}>Prepared</span></div><p>Short follow-up referencing the same approved pitch.</p><Button tone="secondary">Review step</Button></div></EditorFrame>;
  }
  if (step.id === "video") {
    return <EditorFrame title="Video is optional" description="The campaign works without it. Keep the script, record later, or skip it."><div className={styles.videoPlaceholder}><Play size={28} /><span>00:42 personal intro</span></div><div className={styles.sourceBox}><strong>Draft script</strong><p>“Hi Maya — I’m Sarthak. I care a lot about the invisible product details that make complex tools feel calm...”</p></div><div className={styles.editorActions}><Button tone="ghost">Skip video</Button><Button onClick={onReview}>Approve script</Button></div></EditorFrame>;
  }
  if (step.id === "social") {
    return <EditorFrame title="Add a social draft?" description="This is optional and is never generated or published without asking."><div className={styles.emptyAsset}><MessageSquareText size={28} /><h3>No social draft</h3><p>Generate one only if sharing your thinking publicly helps this campaign.</p><Button><Plus size={16} /> Generate optional draft</Button></div></EditorFrame>;
  }
  return <EditorFrame title="Review application kit" description="Every suggestion maps back to a confirmed profile fact."><div className={styles.documentMock}><div className={styles.documentTitle}><div><strong>Sarthak</strong><span>Senior product engineer</span></div><span>Tailored for Linear</span></div><h4>Suggested profile</h4><p>Product-minded engineer with 7 years of experience turning ambiguous B2B workflows into fast, dependable software.</p><span className={styles.sourceTag}><Sparkles size={14} /> Based on resume: product ownership + B2B systems</span><h4>Experience emphasis</h4><p>Lead with the design-system migration and the zero-to-one collaboration platform work. Keep the performance result; remove the less relevant infrastructure bullet.</p><span className={styles.sourceTag}><ShieldCheck size={14} /> No unsupported claims detected</span></div><div className={styles.editorActions}><Button tone="secondary"><RotateCcw size={16} /> Regenerate section</Button><Button onClick={onReview}>Mark kit reviewed</Button></div></EditorFrame>;
}

function EditorFrame({ title, description, children }) {
  return <section className={styles.editorFrame}><header><span className={styles.eyebrow}>Selected asset</span><h2>{title}</h2><p>{description}</p></header>{children}<footer><span><CheckCircle2 size={15} /> Saved just now</span><span>Based on profile version 4</span></footer></section>;
}

function ActivityView({ showMock }) {
  const events = [
    { time: "10:42", icon: Mail, title: "Gmail draft created", role: "Product Designer · Raycast", source: "Confirmed by Gmail", tone: "success" },
    { time: "09:10", icon: AlertTriangle, title: "LinkedIn delivery uncertain", role: "Product Engineer · Notion", source: "Provider check required", tone: "warning" },
    { time: "Yesterday", icon: FileText, title: "Pitch page viewed", role: "Staff Engineer · Loom", source: "Anonymous recipient", tone: "info" },
    { time: "Mon", icon: UserRoundCheck, title: "Interview recorded", role: "Design Engineer · Vercel", source: "Added by you", tone: "success" },
  ];
  return (
    <section className={styles.route}>
      <PageHeader eyebrow="Audit trail and outcomes" title="Activity" description="See what was prepared, what you approved, what providers confirmed, and what happened next." action={<Button onClick={() => showMock("Record outcome dialog opened")}><Plus size={16} /> Record outcome</Button>} />
      <div className={styles.outcomeStrip}>{[{ n: 6, l: "Applied" }, { n: 2, l: "Replied" }, { n: 1, l: "Interviewing" }, { n: 0, l: "Offers" }].map((item) => <div key={item.l}><strong>{item.n}</strong><span>{item.l}</span></div>)}</div>
      <div className={styles.filters}><button type="button" onClick={() => showMock("Activity search opened")}><Search size={16} /> Search</button>{["Opportunity", "Event type", "Status", "Date"].map((label) => <button key={label} type="button" onClick={() => showMock(`${label} filter opened`)}>{label}<ChevronDown size={14} /></button>)}</div>
      <div className={styles.timeline}>{events.map((event) => { const Icon = event.icon; return <article key={`${event.time}-${event.title}`}><time>{event.time}</time><span className={classNames(styles.timelineIcon, styles[event.tone])}><Icon size={17} /></span><div><strong>{event.title}</strong><p>{event.role}</p><small>{event.source}</small></div><Button tone="ghost" onClick={() => showMock(`${event.title} details opened`)}>Open <ArrowRight size={15} /></Button></article>; })}</div>
    </section>
  );
}

function SettingsView({ showMock }) {
  const [section, setSection] = useState("Integrations");
  const sections = ["Profile", "Job preferences", "Integrations", "Outreach defaults", "Billing", "Privacy"];
  return (
    <section className={styles.route}>
      <PageHeader eyebrow="Account and controls" title="Settings" description="Change the inputs behind your search, repair connections, and manage data." />
      <nav className={styles.settingsNav} aria-label="Settings sections">{sections.map((item) => <button key={item} type="button" className={section === item ? styles.settingsActive : ""} aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}>{item}</button>)}</nav>
      {section === "Integrations" ? (
        <div className={styles.settingsContent}>
          <SectionHeading kicker="Named accounts and delivery health" title="Integrations" />
          <ConnectionCard icon={Mail} name="Gmail" identity="sarthak@gmail.com" method="Draft creation" health="Healthy" detail="Last checked 2 minutes ago · 2 active campaigns" onAction={() => showMock("Gmail connection details opened")} />
          <ConnectionCard icon={MessageSquareText} name="LinkedIn" identity="Sarthak Sharma" method="Managed delivery" health="Action needed" detail="One uncertain action · extension fallback available" warning onAction={() => showMock("LinkedIn recovery details opened")} />
          <div className={styles.safetyNote}><ShieldCheck size={19} /><span>Connections enable a channel. They never authorize an outbound action.</span></div>
        </div>
      ) : (
        <div className={styles.settingsContent}><SectionHeading kicker="Prototype section" title={section} /><div className={styles.settingMock}><WandSparkles size={28} /><h3>{section} is represented in the design flow</h3><p>This compact mock keeps the prototype focused on the opportunity-to-outreach loop. The full design contract for this section remains in <code>design/screens/settings.md</code>.</p><Button onClick={() => showMock(`${section} mock change previewed`)}>Try a mock change</Button></div></div>
      )}
    </section>
  );
}

function ConnectionCard({ icon: Icon, name, identity, method, health, detail, warning, onAction }) {
  return <article className={styles.connectionCard}><span className={styles.connectionIcon}><Icon size={22} /></span><div><h3>{name}</h3><p>{identity}</p><small>{method} · {detail}</small></div><span className={classNames(styles.healthBadge, warning && styles.healthWarning)}>{warning ? <AlertTriangle size={14} /> : <Check size={14} />}{health}</span><Button tone="secondary" onClick={onAction}>{warning ? "Review status" : "Manage"}</Button></article>;
}

function Button({ children, tone = "primary", onClick, type = "button" }) {
  return <button type={type} className={classNames(styles.button, styles[`button${tone[0].toUpperCase()}${tone.slice(1)}`])} onClick={onClick}>{children}</button>;
}

function Modal({ title, eyebrow, children, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = modalRef.current?.querySelectorAll(
        "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="prototype-dialog-title"><header><div><span className={styles.eyebrow}>{eyebrow}</span><h2 id="prototype-dialog-title">{title}</h2></div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header>{children}</section></div>;
}

function ReceiptRow({ label, value, strong = false }) {
  return <div className={strong ? styles.receiptStrong : ""}><span>{label}</span><strong>{value}</strong></div>;
}

function PrototypeSwitcher({ current, onCycle }) {
  const selected = VARIANTS.find((item) => item.key === current);
  return (
    <div className={styles.switcher} aria-label="Prototype variant switcher">
      <button type="button" onClick={() => onCycle(-1)} aria-label="Previous variant"><ArrowLeft size={17} /></button>
      <span><small>Variant {selected.key}</small><strong>{selected.name}</strong></span>
      <button type="button" onClick={() => onCycle(1)} aria-label="Next variant"><ArrowRight size={17} /></button>
    </div>
  );
}
