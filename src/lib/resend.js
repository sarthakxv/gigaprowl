// Resend is not the Auth magic-link issuer. Supabase Auth uses Resend through
// its configured production SMTP connection. This API client is only for
// operational/test messages; outreach always goes through connected Gmail.
// from: a verified-domain address in your Resend account, OR the test address
// "onboarding@resend.dev" (which can only deliver to your own account email).
import { isSuppressed } from "@/lib/db";
import { RESEND_TEST_FROM } from "@/lib/constants";

export function resendEnabled() {
  return !!process.env.RESEND_API_KEY;
}

export function resendFrom() {
  return process.env.RESEND_FROM || RESEND_TEST_FROM;
}

// Returns the Resend message id. Throws on failure. Checks the suppression list
// first, so a hard bounce or complaint is never emailed again.
export async function sendResend({ to, subject, text, html, replyTo, fromName }) {
  const primary = Array.isArray(to) ? to[0] : to;
  if (await isSuppressed(primary)) {
    throw new Error(`Recipient suppressed (prior bounce/complaint): ${primary}`);
  }
  const base = resendFrom();
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
