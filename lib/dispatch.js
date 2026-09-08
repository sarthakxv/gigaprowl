// Shared outreach dispatch. Used by /api/send (manual button) and the
// scheduler cron (automatic release). Executes ONE cadence step:
//   • linkedin → Unipile (server-side invite/DM) if connected, else browser-ext queue
//   • email    → Gmail only (draft in manual mode, send in automated)
import { getUserState, updateUserState, uid, bumpDailyCounter, isSuppressed, acquireLock, releaseLock } from "@/lib/db";
import {
  sendGmail,
  createDraft,
  gmailEnabled,
  gmailUsable,
  refreshTokenFromConnection,
  markGmailStatus,
  GmailError,
  assertValidRecipient,
} from "@/lib/gmail";
import { unipileEnabled, resolveProfile, sendInvitation, sendMessage, identifierFromUrl } from "@/lib/unipile";
import { capLinkedInPerDay, capEmailPerDay, OUTREACH_LOCK_TTL_SEC, kvKeys } from "@/lib/constants";

export const isLinkedIn = (ch) => /linkedin|connect|invite|dm/i.test(ch || "");
const isInvite = (ch) => /invite|connect|request/i.test(ch || "");
const ACTIONED = new Set(["sent", "drafted", "queued", "dispatching", "uncertain"]);

export async function dispatchStep(userId, cadenceId, stepIndex) {
  const lockKey = kvKeys.lockOutreach(userId, cadenceId, stepIndex);
  const lockOwner = await acquireLock(lockKey, OUTREACH_LOCK_TTL_SEC);
  if (!lockOwner) throw new GmailError("in_progress", "This step is already being sent");

  try {
    return await runStep(userId, cadenceId, stepIndex);
  } finally {
    await releaseLock(lockKey, lockOwner).catch(() => {});
  }
}

async function runStep(userId, cadenceId, stepIndex) {
  const state = await getUserState(userId);
  const cadence = state.cadences.find((c) => c.id === cadenceId);
  if (!cadence) throw new Error("Cadence not found");
  const step = cadence.steps[stepIndex];
  if (!step) throw new Error("Step not found");
  if (ACTIONED.has(step.status)) return { skipped: true, status: step.status };

  const contact = state.contacts.find((c) => c.id === cadence.contactId) || {};
  const mode = state.settings?.outreachMode === "automated" ? "automated" : "manual";

  if (isLinkedIn(step.channel)) {
    return dispatchLinkedIn({ userId, cadenceId, stepIndex, cadence, step, contact, state });
  }

  return dispatchEmail({ userId, cadenceId, stepIndex, cadence, step, contact, state, mode });
}

async function dispatchLinkedIn({ userId, cadenceId, stepIndex, cadence, step, contact, state }) {
  const identifier = identifierFromUrl(contact.linkedinUrl);
  if (!identifier) throw new Error("No LinkedIn profile URL for this contact");
  const li = state.connections?.linkedin;

  if (unipileEnabled() && li?.accountId) {
    const { allowed } = await bumpDailyCounter(userId, "linkedin", capLinkedInPerDay());
    if (!allowed) throw new Error(`Daily LinkedIn limit reached (${capLinkedInPerDay()}/day). Resumes tomorrow`);
    const providerId = await resolveProfile({ accountId: li.accountId, identifier });
    if (!providerId) throw new Error("Couldn't resolve that LinkedIn profile via Unipile");
    const result = isInvite(step.channel)
      ? await sendInvitation({ accountId: li.accountId, providerId, message: (step.body || "").slice(0, 290) })
      : await sendMessage({ accountId: li.accountId, providerId, text: step.body || "" });
    await markSent(userId, cadenceId, stepIndex, cadence, step.channel, contact.linkedinUrl);
    return { channel: step.channel, via: "unipile", sent: true, result };
  }

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

async function dispatchEmail({ userId, cadenceId, stepIndex, cadence, step, contact, state, mode }) {
  if (!contact.email) throw new Error("No email for this contact (try enriching via LeadMagic)");
  if (await isSuppressed(contact.email)) {
    await markAttempt(userId, cadenceId, stepIndex, "suppressed", false);
    throw new GmailError("suppressed", `Recipient suppressed (prior bounce/complaint): ${contact.email}`);
  }
  const to = assertValidRecipient(contact.email);
  const subject = step.subject || `Quick note re: ${cadence.jobTitle} @ ${cadence.company}`;

  if (!gmailEnabled()) throw new GmailError("unconfigured", "Gmail isn't configured (add GOOGLE_CLIENT_ID/SECRET and GMAIL_TOKEN_ENCRYPTION_KEY)");
  const gmail = state.connections?.gmail;
  if (!gmailUsable(gmail)) {
    await markAttempt(userId, cadenceId, stepIndex, "reauth_required", false);
    throw new GmailError("reauth_required", "Reconnect Gmail first", { reauth: true });
  }

  const { allowed } = await bumpDailyCounter(userId, "email", capEmailPerDay());
  if (!allowed) {
    await markAttempt(userId, cadenceId, stepIndex, "daily_cap", true);
    throw new GmailError("daily_cap", `Daily email limit reached (${capEmailPerDay()}/day). Resumes tomorrow`, { retryable: true });
  }

  let refreshToken;
  try {
    refreshToken = refreshTokenFromConnection(gmail);
  } catch (e) {
    await handleGmailFailure(userId, cadenceId, stepIndex, e);
    throw e;
  }

  const payload = {
    refreshToken,
    from: gmail.email,
    fromName: state.profile?.name || undefined,
    to,
    subject,
    body: step.body || "",
  };

  // Persist an at-most-once reservation before calling Gmail. If the worker is
  // killed after Google accepts the message but before markSent, the scheduler
  // sees this state and leaves the step for manual reconciliation.
  await markDispatching(userId, cadenceId, stepIndex);

  let result;
  try {
    result = mode === "automated"
      ? { messageId: await sendGmail(payload), sent: true }
      : { draftId: await createDraft(payload), drafted: true };
  } catch (e) {
    await handleGmailFailure(userId, cadenceId, stepIndex, e);
    throw e;
  }

  try {
    await markSent(userId, cadenceId, stepIndex, cadence, step.channel, to, result.drafted ? "drafted" : "sent");
  } catch {
    // Keep the persisted `dispatching` reservation. Retrying without knowing
    // whether Google committed the mutation can duplicate outreach.
    throw new GmailError(
      "delivery_uncertain",
      "Google accepted the request, but Gigaprowl could not record it. Check Gmail before trying again.",
    );
  }
  return { channel: step.channel, via: "gmail", mode, ...result };
}

async function markDispatching(userId, cadenceId, stepIndex) {
  await updateUserState(userId, (s) => {
    const cad = s.cadences.find((c) => c.id === cadenceId);
    if (!cad || !cad.steps[stepIndex]) return;
    cad.steps[stepIndex].status = "dispatching";
    cad.steps[stepIndex].lastAttemptAt = new Date().toISOString();
    cad.steps[stepIndex].lastErrorCode = null;
  });
}

async function handleGmailFailure(userId, cadenceId, stepIndex, e) {
  const code = e instanceof GmailError ? e.code : "error";
  const retryable = e instanceof GmailError ? !!e.retryable : true;
  const reauth = e instanceof GmailError && e.reauth;
  if (reauth) await markGmailStatus(userId, "reauth_required", code);
  else if (e instanceof GmailError && e.code === "error") await markGmailStatus(userId, "error", code);
  await markAttempt(userId, cadenceId, stepIndex, code, retryable);
}

async function markAttempt(userId, cadenceId, stepIndex, code, retryable) {
  await updateUserState(userId, (s) => {
    const cad = s.cadences.find((c) => c.id === cadenceId);
    if (!cad || !cad.steps[stepIndex]) return;
    cad.steps[stepIndex].lastAttemptAt = new Date().toISOString();
    cad.steps[stepIndex].lastErrorCode = code;
    if (code === "delivery_uncertain") cad.steps[stepIndex].status = "uncertain";
    else if (cad.steps[stepIndex].status === "dispatching") cad.steps[stepIndex].status = "pending";
    // Retryable and reauth failures stay pending so a later run can succeed.
    if (!retryable && code === "suppressed") cad.steps[stepIndex].status = "failed";
  });
}

async function markSent(userId, cadenceId, stepIndex, cadence, channel, to, status = "sent") {
  await updateUserState(userId, (s) => {
    const cad = s.cadences.find((c) => c.id === cadenceId);
    if (cad && cad.steps[stepIndex]) {
      cad.steps[stepIndex].status = status;
      cad.steps[stepIndex].sentAt = new Date().toISOString();
      cad.steps[stepIndex].lastErrorCode = null;
    }
    s.sends.push({ id: uid("send"), cadenceId, stepIndex, matchId: cadence.matchId, channel, to, status, at: new Date().toISOString() });
  });
}
