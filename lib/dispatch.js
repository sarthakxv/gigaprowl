// Shared outreach dispatch. Used by /api/send (manual button) and the
// scheduler cron (automatic release). Executes ONE cadence step:
//   • linkedin → Unipile (server-side invite/DM) if connected, else browser-ext queue
//   • email    → Resend if configured, else Gmail (draft/send by mode)
import { getUserState, updateUserState, getUserByEmail, uid, bumpDailyCounter } from "@/lib/db";
import { sendGmail, createDraft, gmailEnabled } from "@/lib/gmail";
import { sendResend, resendEnabled } from "@/lib/resend";
import { unipileEnabled, resolveProfile, sendInvitation, sendMessage, identifierFromUrl } from "@/lib/unipile";

export const isLinkedIn = (ch) => /linkedin|connect|invite|dm/i.test(ch || "");
const isInvite = (ch) => /invite|connect|request/i.test(ch || "");
const ACTIONED = new Set(["sent", "drafted", "queued"]);

// Daily per-user safety caps (override via env). Keeps LinkedIn accounts under
// LinkedIn's weekly invite ceiling and email volume under a warm-domain rate.
const CAP_LI = Number(process.env.CAP_LINKEDIN_PER_DAY || 20);
const CAP_EMAIL = Number(process.env.CAP_EMAIL_PER_DAY || 50);

// Throws Error(message) on hard failures so callers can map to a status.
export async function dispatchStep(userId, cadenceId, stepIndex, modeOverride) {
  const state = await getUserState(userId);
  const cadence = state.cadences.find((c) => c.id === cadenceId);
  if (!cadence) throw new Error("Cadence not found");
  const step = cadence.steps[stepIndex];
  if (!step) throw new Error("Step not found");
  if (ACTIONED.has(step.status)) return { skipped: true, status: step.status };

  const contact = state.contacts.find((c) => c.id === cadence.contactId) || {};
  const mode = modeOverride || state.settings?.outreachMode || "manual";

  // ---------------- LinkedIn ----------------
  if (isLinkedIn(step.channel)) {
    const identifier = identifierFromUrl(contact.linkedinUrl);
    if (!identifier) throw new Error("No LinkedIn profile URL for this contact");
    const li = state.connections?.linkedin;

    // Unipile (server-side) path, preferred when an account is connected.
    if (unipileEnabled() && li?.accountId) {
      const { allowed } = await bumpDailyCounter(userId, "linkedin", CAP_LI);
      if (!allowed) throw new Error(`Daily LinkedIn limit reached (${CAP_LI}/day). Resumes tomorrow`);
      const providerId = await resolveProfile({ accountId: li.accountId, identifier });
      if (!providerId) throw new Error("Couldn't resolve that LinkedIn profile via Unipile");
      const result = isInvite(step.channel)
        ? await sendInvitation({ accountId: li.accountId, providerId, message: (step.body || "").slice(0, 290) })
        : await sendMessage({ accountId: li.accountId, providerId, text: step.body || "" });
      await markSent(userId, cadenceId, stepIndex, cadence, step.channel, contact.linkedinUrl);
      return { channel: step.channel, via: "unipile", sent: true, result };
    }

    // Fallback: browser-extension queue.
    const action = {
      id: uid("li"), type: isInvite(step.channel) ? "invite" : "message",
      identifier, message: (step.body || "").slice(0, isInvite(step.channel) ? 290 : 8000),
      cadenceId, stepIndex, matchId: cadence.matchId, status: "pending", at: new Date().toISOString(),
    };
    await updateUserState(userId, (s) => {
      s.linkedinQueue.push(action);
      const cad = s.cadences.find((c) => c.id === cadenceId);
      if (cad && cad.steps[stepIndex]) cad.steps[stepIndex].status = "queued";
    });
    return { channel: step.channel, queued: true, via: "extension" };
  }

  // ---------------- Email ----------------
  if (!contact.email) throw new Error("No email for this contact (try enriching via LeadMagic)");
  const subject = step.subject || `Quick note re: ${cadence.jobTitle} @ ${cadence.company}`;
  const replyTo = state.profile?.email || state.connections?.gmail?.email || undefined;

  // Resend path, preferred when configured. (Resend can't make drafts; always sends.)
  if (resendEnabled()) {
    const { allowed } = await bumpDailyCounter(userId, "email", CAP_EMAIL);
    if (!allowed) throw new Error(`Daily email limit reached (${CAP_EMAIL}/day). Resumes tomorrow`);
    const id = await sendResend({ to: contact.email, subject, text: step.body || "", replyTo, fromName: state.profile?.name });
    await markSent(userId, cadenceId, stepIndex, cadence, step.channel, contact.email);
    return { channel: step.channel, via: "resend", sent: true, messageId: id };
  }

  // Fallback: Gmail send-as (draft in manual mode, send in automated).
  if (!gmailEnabled()) throw new Error("Email isn't configured (add RESEND_API_KEY or Gmail)");
  const gmail = state.connections?.gmail;
  if (!gmail?.refreshToken) throw new Error("Connect Gmail first (or configure Resend)");
  const user = await getUserByEmail(gmail.email || "");
  const payload = { refreshToken: gmail.refreshToken, from: gmail.email, fromName: state.profile?.name || user?.name, to: contact.email, subject, body: step.body || "" };
  const result = mode === "manual" ? { draftId: await createDraft(payload), drafted: true } : { messageId: await sendGmail(payload), sent: true };
  const drafted = !!result.drafted;
  await markSent(userId, cadenceId, stepIndex, cadence, step.channel, contact.email, drafted ? "drafted" : "sent");
  return { channel: step.channel, via: "gmail", mode, ...result };
}

async function markSent(userId, cadenceId, stepIndex, cadence, channel, to, status = "sent") {
  await updateUserState(userId, (s) => {
    const cad = s.cadences.find((c) => c.id === cadenceId);
    if (cad && cad.steps[stepIndex]) { cad.steps[stepIndex].status = status; cad.steps[stepIndex].sentAt = new Date().toISOString(); }
    s.sends.push({ id: uid("send"), cadenceId, stepIndex, matchId: cadence.matchId, channel, to, status, at: new Date().toISOString() });
  });
}
