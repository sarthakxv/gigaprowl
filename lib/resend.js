// Resend. Transactional email for outreach and account mail.
// from: a verified-domain address in your Resend account, OR the test address
// "onboarding@resend.dev" (which can only deliver to your own account email).
// reply_to is set to the candidate so replies land with them.
import { isSuppressed } from "@/lib/db";
import { RESEND_TEST_FROM } from "@/lib/constants";

export function resendEnabled() {
  return !!process.env.RESEND_API_KEY;
}

export function resendFrom() {
  return process.env.RESEND_FROM || RESEND_TEST_FROM;
}

// Dedicated system sender for account emails (verify / reset). Falls back to
// RESEND_FROM, then the test address. Set RESEND_SYSTEM_FROM once you verify a
// domain, e.g. "Gigaprowl <hello@gigaprowl.com>".
export function systemFrom() {
  return process.env.RESEND_SYSTEM_FROM || resendFrom();
}

// Returns the Resend message id. Throws on failure.
// opts.system=true  -> account email (verify/reset): uses systemFrom, bypasses suppression.
// opts.system=false -> outreach: checks the suppression list first (hard bounces / complaints).
export async function sendResend({ to, subject, text, html, replyTo, fromName, system = false }) {
  const primary = Array.isArray(to) ? to[0] : to;
  if (!system && (await isSuppressed(primary))) {
    throw new Error(`Recipient suppressed (prior bounce/complaint): ${primary}`);
  }
  const base = system ? systemFrom() : resendFrom();
  const from = fromName ? base.replace(/^[^<]*/, `${fromName} `) : base;
  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : { text: text || "" }),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error(`Resend ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d.id;
}

// Convenience for account emails (verify / reset).
export async function sendSystemEmail({ to, subject, html, text }) {
  return sendResend({ to, subject, html, text, system: true });
}
