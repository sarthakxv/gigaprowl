// Best-effort company domain from a name. If the name already looks like a
// host (Lemon.io → lemon.io), keep it. Otherwise slug + ".com" (Stripe → stripe.com).

const HOST_TLDS = new Set([
  "com", "io", "ai", "net", "org", "co", "so", "dev", "app", "gg", "me", "fm", "vc", "xyz", "tech",
]);

export function guessCompanyDomain(company) {
  if (!company) return null;
  let s = String(company).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
  s = s.replace(/\s+\b(inc|llc|ltd|corp|co|gmbh)\.?$/g, "").trim();

  const tld = s.split(".").pop();
  if (s.includes(".") && HOST_TLDS.has(tld) && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) {
    return s;
  }

  const slug = s.replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}.com` : null;
}
