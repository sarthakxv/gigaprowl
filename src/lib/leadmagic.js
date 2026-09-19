// LeadMagic. Find and verify a hiring manager's work email.
// Used to fill in emails that Apollo returns locked/empty so the Gmail
// outreach step actually has somewhere to send. Degrades to null (never
// throws) so a missing key or a miss can't break the hunt.

import { guessCompanyDomain } from "@/lib/domain";

const BASE = "https://api.leadmagic.io";

export function leadmagicEnabled() {
  return !!process.env.LEADMAGIC_API_KEY;
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": process.env.LEADMAGIC_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`LeadMagic ${path} ${r.status}: ${JSON.stringify(d).slice(0, 160)}`);
  return d;
}

// Returns { email, status } or null. `status` is LeadMagic's deliverability
// verdict (e.g. "valid", "catch_all", "unknown").
export async function findEmail({ firstName, lastName, company, domain }) {
  if (!leadmagicEnabled() || !firstName || !lastName) return null;
  const dom = domain || guessCompanyDomain(company);
  try {
    const d = await post("/email-finder", {
      first_name: firstName,
      last_name: lastName,
      ...(dom ? { domain: dom } : {}),
      ...(company ? { company_name: company } : {}),
    });
    const email = d.email || d.data?.email || null;
    if (!email) return null;
    return { email, status: d.status || d.email_status || d.data?.status || "found" };
  } catch (e) {
    console.warn("LeadMagic findEmail failed:", e.message);
    return null;
  }
}

// Verify an email we already have. Returns { email, status } or null.
export async function verifyEmail(email) {
  if (!leadmagicEnabled() || !email) return null;
  try {
    const d = await post("/email-validate", { email });
    return { email, status: d.status || d.email_status || d.data?.status || "unknown" };
  } catch (e) {
    console.warn("LeadMagic verifyEmail failed:", e.message);
    return null;
  }
}
