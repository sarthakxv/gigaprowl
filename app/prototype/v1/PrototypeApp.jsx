"use client";

// Chosen v1 prototype direction: Variant A plus the complete onboarding flow.
// PROTOTYPE ONLY: every value and interaction on this route is held in memory.

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Command,
  ExternalLink,
  FileUp,
  FileCheck2,
  FileText,
  Gauge,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageSquareText,
  Moon,
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
  Sun,
  Target,
  UserRoundCheck,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./prototype.module.css";

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

const initialOnboarding = {
  complete: false,
  step: "source",
  source: null,
  sourceLabel: null,
  profile: {
    name: "Sarthak Sharma",
    title: "Senior Product Engineer",
    seniority: "Senior",
    skills: ["React", "TypeScript", "Product systems", "Design systems"],
    experience: "7 years building B2B products, frontend platforms, and design systems across product and engineering teams.",
    positioning: "Product engineer with experience turning ambiguous workflows into dependable B2B software.",
  },
  targetRoles: ["Senior Product Engineer", "Design Engineer"],
  locationMode: "remote",
  location: "India",
  authorization: "",
  scanStatus: "idle",
};

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function PrototypeApp() {
  const [view, setView] = useState("today");
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [campaign, setCampaign] = useState(initialCampaign);
  const [credits, setCredits] = useState(3);
  const [saved, setSaved] = useState(["linear"]);
  const [dismissed, setDismissed] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(initialOnboarding);
  const [firstScanRunning, setFirstScanRunning] = useState(false);
  const [theme, setTheme] = useState("light");

  const currentOpportunity = selectedOpportunity
    ? opportunities.find((item) => item.id === selectedOpportunity)
    : null;

  const mockState = useMemo(
    () => ({
      onboarding,
      theme,
      view: currentOpportunity ? `opportunity:${currentOpportunity.id}` : view,
      huntCredits: credits,
      savedOpportunityIds: saved,
      dismissedOpportunityIds: dismissed,
      campaign,
    }),
    [campaign, credits, currentOpportunity, dismissed, onboarding, saved, theme, view],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function navigate(next) {
    setSelectedOpportunity(null);
    setView(next);
  }

  function restartOnboarding() {
    setOnboarding(initialOnboarding);
    setFirstScanRunning(false);
    setSelectedOpportunity(null);
    setView("today");
    setStateOpen(false);
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
    setToast("Opportunity dismissed · Undo available");
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
    setToast("Campaign created · No content sent or published");
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
    setToast("Mock Gmail draft created · Gmail was not contacted");
  }

  const sharedProps = {
    view,
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
    firstScanRunning,
  };

  return (
    <div className={classNames(styles.prototype, theme === "dark" && styles.darkTheme)}>
      <a className={styles.skipLink} href="#prototype-main">Skip to main content</a>
      <div className={styles.prototypeFlag}><Sparkles size={14} /> UX prototype · Mock data only</div>

      {onboarding.complete ? (
        <ProductShell {...sharedProps} />
      ) : (
        <Onboarding
          onboarding={onboarding}
          setOnboarding={setOnboarding}
          setFirstScanRunning={setFirstScanRunning}
          showMock={showMock}
        />
      )}

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
            <span>Creating this campaign generates drafts. It does not publish, schedule, or send them.</span>
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
            <p>A short case for this product-engineering match.</p>
          </div>
          <p className={styles.modalLead}>Anyone with the link can view this page. You can unpublish it from the campaign workspace.</p>
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
            <p>Hi Maya, I’ve spent the last few years turning ambiguous product problems into fast, careful software...</p>
          </div>
          <div className={styles.safetyNote}>
            <ShieldCheck size={19} />
            <span>You approved this draft. Editing it will require a new approval.</span>
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
            <span>The prototype created this receipt without contacting Gmail or sending email.</span>
          </div>
          <div className={styles.modalActions}>
            <Button onClick={() => setDialog(null)}>Done</Button>
          </div>
        </Modal>
      )}

      {toast && <div className={styles.toast} role="status"><CheckCircle2 size={18} /> {toast}</div>}

      {onboarding.complete && (
        <button className={styles.restartButton} type="button" onClick={restartOnboarding} aria-label="Restart onboarding">
          <RotateCcw size={15} /> <span>Restart onboarding</span>
        </button>
      )}
      <button
        className={styles.themeButton}
        type="button"
        onClick={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        aria-pressed={theme === "dark"}
      >
        {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
      </button>
      <button className={styles.stateButton} type="button" onClick={() => setStateOpen((value) => !value)}>
        <Command size={15} /> Mock state
      </button>
      {stateOpen && (
        <aside className={styles.statePanel} aria-label="Current prototype state">
          <div><strong>Current in-memory state</strong><button type="button" onClick={() => setStateOpen(false)} aria-label="Close mock state"><X size={16} /></button></div>
          <pre>{JSON.stringify(mockState, null, 2)}</pre>
        </aside>
      )}

    </div>
  );
}

const onboardingStepOrder = ["source", "profile", "roles", "location", "authorization", "review"];

function Onboarding({ onboarding, setOnboarding, setFirstScanRunning, showMock }) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [experienceText, setExperienceText] = useState("Senior product engineer with 7 years building B2B software, frontend systems, and design systems.");
  const [customRole, setCustomRole] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const stepIndex = onboardingStepOrder.indexOf(onboarding.step);
  const profileReady = Boolean(
    onboarding.profile.name.trim()
    && onboarding.profile.title.trim()
    && onboarding.profile.experience.trim()
    && onboarding.profile.positioning.trim(),
  );

  function update(patch) {
    setOnboarding((value) => ({ ...value, ...patch }));
  }

  function chooseSource(source, sourceLabel) {
    update({ source, sourceLabel, step: "profile" });
    showMock(`Profile created from ${sourceLabel}`);
  }

  function updateProfile(field, value) {
    setOnboarding((current) => ({
      ...current,
      profile: { ...current.profile, [field]: value },
    }));
  }

  function toggleRole(role) {
    setOnboarding((current) => ({
      ...current,
      targetRoles: current.targetRoles.includes(role)
        ? current.targetRoles.filter((item) => item !== role)
        : [...current.targetRoles, role],
    }));
  }

  function addCustomRole() {
    const role = customRole.trim();
    if (!role) return;
    setOnboarding((current) => ({
      ...current,
      targetRoles: [...new Set([...current.targetRoles, role])],
    }));
    setCustomRole("");
  }

  function addCustomSkill() {
    const skill = customSkill.trim();
    if (!skill) return;
    updateProfile("skills", [...new Set([...onboarding.profile.skills, skill])]);
    setCustomSkill("");
  }

  function goBack() {
    const previous = onboardingStepOrder[Math.max(0, stepIndex - 1)];
    update({ step: previous });
  }

  function startScan() {
    update({ step: "scanning", scanStatus: "running" });
  }

  function openToday() {
    update({ complete: true, scanStatus: "running" });
    setFirstScanRunning(true);
  }

  return (
    <div className={styles.onboardingShell}>
      <header className={styles.onboardingTopbar}>
        <Brand />
        <span><CheckCircle2 size={15} /> Saved for this mock session</span>
      </header>
      <main id="prototype-main" className={styles.onboardingLayout}>
        <aside className={styles.onboardingRail}>
          <span className={styles.eyebrow}>Set up your search</span>
          <h1>Build your candidate profile</h1>
          <p>Check the details Gigaprowl extracted and set the constraints for your search.</p>
          <ol>
            {onboardingStepOrder.map((step, index) => {
              const complete = onboarding.step === "scanning" || index < stepIndex;
              const active = onboarding.step === step;
              return (
                <li key={step} className={classNames(active && styles.onboardingStepActive, complete && styles.onboardingStepComplete)}>
                  <span>{complete ? <Check size={14} /> : index + 1}</span>
                  <div><strong>{["Profile source", "Review profile", "Target roles", "Location", "Work authorization", "Confirm search"][index]}</strong><small>{active ? "Current step" : complete ? "Complete" : "Not started"}</small></div>
                </li>
              );
            })}
          </ol>
          <div className={styles.onboardingPromise}><ShieldCheck size={19} /><span><strong>Finish the required setup</strong>You can connect email and LinkedIn when you create outreach. Photo, voice, and message style stay optional.</span></div>
        </aside>

        <section className={styles.onboardingCard} aria-live="polite">
          {onboarding.step === "source" && (
            <>
              <OnboardingHeader step="Step 1 of 6" title="Choose your profile source" description="Import your work history. You can review the extracted profile before you confirm it." />
              <div className={styles.sourceChoices}>
                <button type="button" onClick={() => chooseSource("resume", "Mock resume PDF")}>
                  <span><FileUp size={21} /></span><div><strong>Upload resume or LinkedIn PDF</strong><p>Use PDF, DOCX, or TXT. This prototype loads a safe mock resume.</p></div><ArrowRight size={18} />
                </button>
                <button type="button" onClick={() => setPasteOpen((value) => !value)} aria-expanded={pasteOpen}>
                  <span><FileText size={21} /></span><div><strong>Paste experience text</strong><p>Paste a summary if you do not have a current resume.</p></div><ChevronDown size={18} />
                </button>
                <button type="button" onClick={() => chooseSource("scout", "Scout preview")}>
                  <span><Radar size={21} /></span><div><strong>Continue from Scout</strong><p>Use the profile from your Scout report.</p></div><ArrowRight size={18} />
                </button>
              </div>
              {pasteOpen && (
                <div className={styles.pastePanel}>
                  <label htmlFor="experience-text">Experience summary</label>
                  <textarea id="experience-text" value={experienceText} onChange={(event) => setExperienceText(event.target.value)} />
                  <Button onClick={() => chooseSource("pasted", "Pasted experience")} disabled={!experienceText.trim()}>Analyze this experience</Button>
                </div>
              )}
              <p className={styles.onboardingFootnote}><ShieldCheck size={15} /> You will enter work authorization in step 5. Gigaprowl does not infer it from your resume.</p>
            </>
          )}

          {onboarding.step === "profile" && (
            <>
              <OnboardingHeader step="Step 2 of 6" title="Review your profile" description={`Gigaprowl extracted these details from ${onboarding.sourceLabel}. Edit anything that could affect a match or generated claim.`} />
              <div className={styles.formGrid}>
                <Field label="Name" value={onboarding.profile.name} onChange={(value) => updateProfile("name", value)} />
                <Field label="Current title" value={onboarding.profile.title} onChange={(value) => updateProfile("title", value)} />
                <label className={styles.field}><span>Seniority</span><select value={onboarding.profile.seniority} onChange={(event) => updateProfile("seniority", event.target.value)}><option>Mid-level</option><option>Senior</option><option>Staff</option><option>Lead</option></select></label>
                <div className={styles.field}><span>Core skills</span><div className={styles.skillList}>{onboarding.profile.skills.map((skill) => <button key={skill} type="button" onClick={() => updateProfile("skills", onboarding.profile.skills.filter((item) => item !== skill))}>{skill}<X size={13} /></button>)}</div><div className={styles.skillEditor}><input aria-label="Add a core skill" value={customSkill} onChange={(event) => setCustomSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomSkill(); } }} placeholder="Add a skill" /><Button tone="secondary" onClick={addCustomSkill} disabled={!customSkill.trim()}>Add</Button></div></div>
                <label className={classNames(styles.field, styles.fieldFull)}><span>Experience</span><textarea value={onboarding.profile.experience} onChange={(event) => updateProfile("experience", event.target.value)} /></label>
                <label className={classNames(styles.field, styles.fieldFull)}><span>Professional positioning</span><textarea value={onboarding.profile.positioning} onChange={(event) => updateProfile("positioning", event.target.value)} /></label>
              </div>
              <OnboardingActions onBack={goBack} onNext={() => update({ step: "roles" })} nextLabel="Confirm profile" disabled={!profileReady} />
            </>
          )}

          {onboarding.step === "roles" && (
            <>
              <OnboardingHeader step="Step 3 of 6" title="Choose your target roles" description="Select the roles you want Gigaprowl to find." />
              <div className={styles.choiceGrid}>
                {["Senior Product Engineer", "Design Engineer", "Frontend Engineer", "Founding Engineer", "Engineering Lead", "Product Engineer"].map((role) => (
                  <button key={role} type="button" className={onboarding.targetRoles.includes(role) ? styles.choiceSelected : ""} aria-pressed={onboarding.targetRoles.includes(role)} onClick={() => toggleRole(role)}>{onboarding.targetRoles.includes(role) && <Check size={16} />}{role}</button>
                ))}
              </div>
              <div className={styles.inlineField}><label htmlFor="custom-role">Add another role</label><div><input id="custom-role" value={customRole} onChange={(event) => setCustomRole(event.target.value)} placeholder="e.g. Staff Frontend Engineer" /><Button tone="secondary" onClick={addCustomRole}>Add role</Button></div></div>
              <p className={styles.selectionCount}>{onboarding.targetRoles.length} selected · At least one role is required.</p>
              <OnboardingActions onBack={goBack} onNext={() => update({ step: "location" })} nextLabel="Set location" disabled={onboarding.targetRoles.length === 0} />
            </>
          )}

          {onboarding.step === "location" && (
            <>
              <OnboardingHeader step="Step 4 of 6" title="Set your location preferences" description="Choose where you can work." />
              <RadioCards
                name="location-mode"
                value={onboarding.locationMode}
                onChange={(locationMode) => update({ locationMode })}
                options={[
                  { value: "remote", title: "Remote only", description: "Show roles that support remote work from my location." },
                  { value: "either", title: "Remote or local", description: "Include remote roles and roles near my chosen location." },
                  { value: "specific", title: "Specific location", description: "Show roles based in one city or region." },
                ]}
              />
              <Field label="Your location" value={onboarding.location} onChange={(location) => update({ location })} description="Used to evaluate remote eligibility and local roles." />
              <OnboardingActions onBack={goBack} onNext={() => update({ step: "authorization" })} nextLabel="Set work authorization" disabled={!onboarding.location.trim()} />
            </>
          )}

          {onboarding.step === "authorization" && (
            <>
              <OnboardingHeader step="Step 5 of 6" title="Set your work authorization" description="Your answer filters roles that require sponsorship. Gigaprowl does not infer it from your resume." />
              <RadioCards
                name="authorization"
                value={onboarding.authorization}
                onChange={(authorization) => update({ authorization })}
                options={[
                  { value: "authorized", title: "Authorized for my target locations", description: "I do not need employer sponsorship for the roles I want." },
                  { value: "sponsorship", title: "I need sponsorship", description: "Show sponsorship evidence when available and label uncertainty." },
                  { value: "unknown", title: "Prefer not to say", description: "Gigaprowl will mark sponsorship compatibility as unknown." },
                ]}
              />
              <div className={styles.safetyNote}><ShieldCheck size={19} /><span>Gigaprowl uses this answer to check job requirements in this prototype.</span></div>
              <OnboardingActions onBack={goBack} onNext={() => update({ step: "review" })} nextLabel="Review search" disabled={!onboarding.authorization} />
            </>
          )}

          {onboarding.step === "review" && (
            <>
              <OnboardingHeader step="Step 6 of 6" title="Review your search settings" description="Confirm these inputs before you run the mock scan. The scan does not connect accounts or contact anyone." />
              <div className={styles.reviewSummary}>
                <ReviewSection label="Profile" value={`${onboarding.profile.name} · ${onboarding.profile.title} · ${onboarding.profile.seniority}`} onEdit={() => update({ step: "profile" })} />
                <ReviewSection label="Target roles" value={onboarding.targetRoles.join(" · ")} onEdit={() => update({ step: "roles" })} />
                <ReviewSection label="Location" value={`${onboarding.locationMode === "remote" ? "Remote only" : onboarding.locationMode === "either" ? "Remote or local" : "Specific location"} · ${onboarding.location}`} onEdit={() => update({ step: "location" })} />
                <ReviewSection label="Work authorization" value={onboarding.authorization === "authorized" ? "Authorized for target locations" : onboarding.authorization === "sponsorship" ? "Sponsorship required" : "Prefer not to say · compatibility remains unknown"} onEdit={() => update({ step: "authorization" })} />
              </div>
              <div className={styles.onboardingPromise}><Sparkles size={19} /><span><strong>Your first scan</strong>Gigaprowl will rank a short list of roles and show the evidence and gaps for each match. Results appear on Today.</span></div>
              <OnboardingActions onBack={goBack} onNext={startScan} nextLabel="Start first scan" />
            </>
          )}

          {onboarding.step === "scanning" && (
            <div className={styles.scanningState}>
              <span className={styles.scanRadar}><Radar size={32} /></span>
              <span className={styles.eyebrow}>First scan running</span>
              <h2>Your profile is ready</h2>
              <p>The mock scan is ranking roles. Open Today to review the starter matches and track progress.</p>
              <div className={styles.scanSteps}><span><CheckCircle2 size={17} /> Profile and constraints confirmed</span><span><CheckCircle2 size={17} /> Sources selected</span><span className={styles.scanActive}><RotateCcw size={17} /> Ranking credible matches</span></div>
              <Button onClick={openToday}>Open Today <ArrowRight size={17} /></Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function OnboardingHeader({ step, title, description }) {
  return <header className={styles.onboardingHeader}><span className={styles.eyebrow}>{step}</span><h2>{title}</h2><p>{description}</p></header>;
}

function OnboardingActions({ onBack, onNext, nextLabel, disabled = false }) {
  return <div className={styles.onboardingActions}><Button tone="ghost" onClick={onBack}><ArrowLeft size={17} /> Back</Button><Button onClick={onNext} disabled={disabled}>{nextLabel} <ArrowRight size={17} /></Button></div>;
}

function Field({ label, value, onChange, description }) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <label className={styles.field} htmlFor={id}><span>{label}</span><input id={id} value={value} onChange={(event) => onChange(event.target.value)} />{description && <small>{description}</small>}</label>;
}

function RadioCards({ name, value, onChange, options }) {
  return <fieldset className={styles.radioCards}><legend className={styles.srOnly}>{name}</legend>{options.map((option) => <label key={option.value} className={value === option.value ? styles.radioSelected : ""}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span><Circle size={18} /></span><div><strong>{option.title}</strong><p>{option.description}</p></div></label>)}</fieldset>;
}

function ReviewSection({ label, value, onEdit }) {
  return <section><div><span>{label}</span><p>{value}</p></div><button type="button" onClick={onEdit}>Edit</button></section>;
}

function ProductShell(props) {
  return (
    <div className={styles.shellA}>
      <SideNav {...props} />
      <main id="prototype-main" className={styles.mainA}>
        <TopContext credits={props.credits} compact />
        <RouteContent {...props} />
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
  return <div className={classNames(styles.brand, compact && styles.brandCompact)}><span><img src="/prototype/v1/logo-vector.svg" alt="" width="44" height="44" /></span>{!compact && <strong>gigaprowl</strong>}</div>;
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
      <PageHeader eyebrow="Wednesday · September 10" title="Good afternoon, Sarthak" description="You have four items to review. The LinkedIn delivery check blocks the next outreach step." />

      {props.firstScanRunning && (
        <div className={styles.scanStatus} role="status">
          <span><Radar size={21} /></span>
          <div><strong>Your first scan is running</strong><p>Gigaprowl is ranking product and frontend roles. You can review the starter matches now.</p></div>
          <small><RotateCcw size={14} /> Comparing fit evidence</small>
        </div>
      )}

      <div className={styles.priorityAlert}>
        <div className={styles.alertIcon}><AlertTriangle size={21} /></div>
        <div><span>Safety check</span><strong>LinkedIn delivery needs confirmation</strong><p>Gigaprowl has not confirmed whether LinkedIn sent the Notion connection request. Check its status before you retry.</p></div>
        <Button tone="warning" onClick={() => props.showMock("Opened mock recovery · LinkedIn was not contacted")}>Check delivery</Button>
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
            <SectionHeading kicker="Added since yesterday" title="New matches" count="3" />
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
  return <header className={styles.sectionHeading}><div>{kicker && <span>{kicker}</span>}<h2>{title}</h2></div>{count !== undefined && <strong>{count}</strong>}</header>;
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
      <div><span>This month</span><h3>Search activity</h3><p>3 applications · 2 replies · 1 interview</p><div className={styles.sparkBars}>{[30, 45, 36, 64, 54, 78, 92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
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
        description="Review the evidence for each fit score, then save or dismiss the role."
        action={<Button onClick={() => props.showMock("Queued mock refresh · Kept current matches")}><RotateCcw size={17} /> Refresh opportunities</Button>}
      />
      <div className={styles.filters}>
        <label className={styles.searchField}><Search size={18} /><span className={styles.srOnly}>Search opportunities</span><input placeholder="Search role or company" /></label>
        {["Freshness", "Location", "Fit", "State"].map((label) => <button className={styles.desktopFilter} key={label} type="button" onClick={() => props.showMock(`${label} filter menu opened`)}>{label}<ChevronDown size={15} /></button>)}
        <button className={styles.mobileFilter} type="button" onClick={() => props.showMock("Opened 4 filter groups")}>Filters 4 <ChevronDown size={15} /></button>
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
            <span className={styles.eyebrow}>Match summary</span>
            <h2>Your profile matches the role’s product ownership and frontend requirements.</h2>
            <div className={styles.evidenceGrid}>
              <div><strong>Aligned evidence</strong>{opportunity.evidence.map((item) => <p key={item}><CheckCircle2 size={17} />{item}</p>)}</div>
              <div><strong>Open questions</strong><p><AlertTriangle size={17} />{opportunity.gap}</p><p><Circle size={17} />Compensation fit is unknown</p></div>
            </div>
          </section>
          <section className={styles.detailSection}><h2>Required constraints</h2><div className={styles.constraintRows}><span><MapPin size={17} />Remote preference<strong>Aligned</strong></span><span><ShieldCheck size={17} />Work authorization<strong>Aligned</strong></span><span><Gauge size={17} />Seniority<strong>Aligned</strong></span></div></section>
          <section className={styles.detailSection}><h2>About the role</h2><p>You would own product areas from the first sketch through implementation. You would work with design, write technical plans, and improve the team’s development systems.</p><button className={styles.textLink} type="button">Read full job description <ExternalLink size={15} /></button></section>
        </div>
        <aside className={styles.decisionRail}>
          <span className={styles.eyebrow}>Recommended next step</span>
          <h2>Start a focused outreach campaign</h2>
          <p>The role fits your profile, and Maya Chen leads the product team.</p>
          <Button onClick={props.startCampaign}><Target size={17} /> Start outreach campaign</Button>
          <small>Uses 1 Hunt credit after confirmation.</small>
          <div className={styles.or}><span />or<span /></div>
          <Button tone="secondary" onClick={() => props.showMock("Application kit generation preview opened")}><FileCheck2 size={17} /> Create application kit</Button>
          <small>Gigaprowl creates editable material. You submit the application.</small>
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
    ? `Review ${campaignSteps.find((step) => step.id === nextStep)?.label.toLowerCase() || "next asset"}`
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
    return <EditorFrame title="Confirm your contact" description="Maya leads the product team hiring for this role."><div className={styles.contactHero}><span className={styles.avatar}>MC</span><div><h3>Maya Chen</h3><p>VP Product · Linear</p><span><ShieldCheck size={15} /> Verified work email · High confidence</span></div></div><div className={styles.sourceBox}><strong>Contact evidence</strong><p>Maya leads the product organization for this role and has posted about hiring senior product engineers.</p><small>Sources: company leadership page · public LinkedIn profile</small></div><div className={styles.editorActions}><Button tone="secondary">Replace contact</Button><Button onClick={onReview}>Confirm contact</Button></div></EditorFrame>;
  }
  if (step.id === "pitch") {
    return <EditorFrame title="Edit the pitch page" description={campaign.pitchPublished ? "Anyone with the link can view this page." : "Only you can view this draft."}><div className={styles.pitchPreviewLarge}><span>SARTHAK × LINEAR</span><h3>I build fast, calm tools for demanding teams.</h3><p>Two relevant projects and a short case study for the Linear team.</p><button type="button">Preview full page <ExternalLink size={15} /></button></div><div className={styles.editorActions}><Button tone="secondary"><PenLine size={16} /> Edit pitch</Button>{campaign.pitchPublished ? <Button tone="secondary" onClick={() => setCampaign((value) => ({ ...value, pitchPublished: false }))}>Unpublish</Button> : <Button onClick={() => setDialog({ type: "publish" })}>Publish pitch by link</Button>}</div></EditorFrame>;
  }
  if (step.id === "outreach") {
    return <EditorFrame title="Review outreach steps" description="Approve each action. An approval covers one draft."><div className={styles.deliveryCard}><div><span className={styles.stepNumber}>1</span><span><strong>Intro email to Maya</strong><small>Gmail draft · Due today</small></span><span className={styles.statusBadge}>{campaign.delivery}</span></div><p>Hi Maya, I’ve spent the last few years turning ambiguous product problems into fast, careful software...</p><Button onClick={() => setDialog({ type: campaign.delivery === "draft" ? "delivery" : "deliveryReceipt" })}>{campaign.delivery === "draft" ? "Review and approve" : "Open draft receipt"}</Button></div><div className={styles.deliveryCard}><div><span className={styles.stepNumber}>2</span><span><strong>LinkedIn follow-up</strong><small>Suggested 3 days after email</small></span><span className={styles.statusBadge}>Prepared</span></div><p>Short follow-up referencing the approved pitch.</p><Button tone="secondary">Review step</Button></div></EditorFrame>;
  }
  if (step.id === "video") {
    return <EditorFrame title="Video is optional" description="Record from the draft script or skip this step."><div className={styles.videoPlaceholder}><Play size={28} /><span>00:42 personal intro</span></div><div className={styles.sourceBox}><strong>Draft script</strong><p>“Hi Maya, I’m Sarthak. I focus on the product details that make complex tools feel calm...”</p></div><div className={styles.editorActions}><Button tone="ghost">Skip video</Button><Button onClick={onReview}>Approve script</Button></div></EditorFrame>;
  }
  if (step.id === "social") {
    return <EditorFrame title="Add a social draft?" description="Gigaprowl creates a draft after you request one. Publishing requires your approval."><div className={styles.emptyAsset}><MessageSquareText size={28} /><h3>No social draft</h3><p>Create one if a public post supports this campaign.</p><Button><Plus size={16} /> Generate optional draft</Button></div></EditorFrame>;
  }
  return <EditorFrame title="Review application kit" description="Each suggestion cites a confirmed profile fact."><div className={styles.documentMock}><div className={styles.documentTitle}><div><strong>Sarthak</strong><span>Senior product engineer</span></div><span>Tailored for Linear</span></div><h4>Suggested profile</h4><p>Product engineer with 7 years of experience turning ambiguous B2B workflows into dependable software.</p><span className={styles.sourceTag}><Sparkles size={14} /> Based on resume: product ownership + B2B systems</span><h4>Experience emphasis</h4><p>Lead with the design-system migration and collaboration platform work. Keep the performance result and remove the infrastructure bullet.</p><span className={styles.sourceTag}><ShieldCheck size={14} /> No unsupported claims detected</span></div><div className={styles.editorActions}><Button tone="secondary"><RotateCcw size={16} /> Regenerate section</Button><Button onClick={onReview}>Mark kit reviewed</Button></div></EditorFrame>;
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
      <PageHeader eyebrow="Audit trail and outcomes" title="Activity" description="Review prepared work, approvals, provider receipts, and outcomes." action={<Button onClick={() => showMock("Opened record outcome dialog")}><Plus size={16} /> Record outcome</Button>} />
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
          <div className={styles.safetyNote}><ShieldCheck size={19} /><span>Connecting a channel does not approve sends. Approve each outbound action.</span></div>
        </div>
      ) : (
        <div className={styles.settingsContent}><SectionHeading kicker="Prototype section" title={section} /><div className={styles.settingMock}><WandSparkles size={28} /><h3>{section} design reference</h3><p>Open <code>design/screens/settings.md</code> for the complete design contract. This prototype covers the opportunity and outreach flow.</p><Button onClick={() => showMock(`Previewed ${section} change`)}>Try a mock change</Button></div></div>
      )}
    </section>
  );
}

function ConnectionCard({ icon: Icon, name, identity, method, health, detail, warning, onAction }) {
  return <article className={styles.connectionCard}><span className={styles.connectionIcon}><Icon size={22} /></span><div><h3>{name}</h3><p>{identity}</p><small>{method} · {detail}</small></div><span className={classNames(styles.healthBadge, warning && styles.healthWarning)}>{warning ? <AlertTriangle size={14} /> : <Check size={14} />}{health}</span><Button tone="secondary" onClick={onAction}>{warning ? "Review status" : "Manage"}</Button></article>;
}

function Button({ children, disabled = false, tone = "primary", onClick, type = "button" }) {
  return <button type={type} disabled={disabled} className={classNames(styles.button, styles[`button${tone[0].toUpperCase()}${tone.slice(1)}`])} onClick={onClick}>{children}</button>;
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
