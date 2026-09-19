// LinkedIn automation via Unipile. Unipile hosts the account-connection wizard
// (the user logs into their own LinkedIn once), then we drive invitations + DMs
// through their API using the returned account_id.
//
// NOTE: automated LinkedIn outreach is against LinkedIn's ToS and can get
// accounts rate-limited/restricted. We keep volumes low and human-paced.
//
// Env: UNIPILE_DSN (e.g. https://api8.unipile.com:13851) + UNIPILE_API_KEY.

function dsn() {
  let d = (process.env.UNIPILE_DSN || "").trim().replace(/\/$/, "");
  if (d && !/^https?:\/\//i.test(d)) d = "https://" + d; // DSN may be stored without scheme
  return d;
}

export function unipileEnabled() {
  return !!(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY);
}

async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(`${dsn()}${path}`, {
    method,
    headers: {
      "X-API-KEY": process.env.UNIPILE_API_KEY,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Unipile ${path} ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

// Create the hosted connect link the user visits to link their LinkedIn.
// `name` is echoed back to notify_url so we can tie the new account to our user.
export async function hostedAuthLink({ base, name }) {
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return api("/api/v1/hosted/accounts/link", {
    method: "POST",
    body: {
      type: "create",
      providers: ["LINKEDIN"],
      api_url: dsn(),
      expiresOn,
      name, // our userId
      success_redirect_url: `${base}/dashboard?connect=linkedin_ok`,
      failure_redirect_url: `${base}/dashboard?connect=linkedin_failed`,
      notify_url: `${base}/api/connect/linkedin/callback`,
    },
  });
}

// Resolve a LinkedIn public identifier (the /in/<slug> part) to a provider_id.
export async function resolveProfile({ accountId, identifier }) {
  const d = await api(`/api/v1/users/${encodeURIComponent(identifier)}?account_id=${accountId}`);
  return d.provider_id || d.id || null;
}

// Send a connection request (optionally with a note).
export async function sendInvitation({ accountId, providerId, message }) {
  return api("/api/v1/users/invite", {
    method: "POST",
    body: { account_id: accountId, provider_id: providerId, ...(message ? { message } : {}) },
  });
}

// Send a direct message (for already-connected contacts). The /chats endpoint
// expects multipart/form-data (per Unipile docs), not JSON.
export async function sendMessage({ accountId, providerId, text }) {
  const form = new FormData();
  form.append("account_id", accountId);
  form.append("attendees_ids", providerId);
  form.append("text", text || "");
  const r = await fetch(`${dsn()}/api/v1/chats`, {
    method: "POST",
    headers: { "X-API-KEY": process.env.UNIPILE_API_KEY, accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Unipile /chats ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

// Fetch the connected account's own info (sanity check the connection).
export async function getMe(accountId) {
  return api(`/api/v1/accounts/${accountId}`);
}

// List every account connected under our Unipile API key. Used to reconcile a
// just-finished hosted-auth session when the notify_url webhook doesn't fire.
export async function listAccounts() {
  const d = await api(`/api/v1/accounts`);
  return d.items || d.accounts || d.data || [];
}

// Every LinkedIn account under our key, newest first, normalized.
export async function listLinkedInAccounts() {
  const all = await listAccounts();
  const isLI = (a) => /linkedin/i.test(a.type || a.provider || a.object || "");
  return all
    .filter(isLI)
    .map((a) => ({ accountId: a.id, name: a.name || null, createdAt: a.created_at || a.createdAt || null, tag: a.name || a.connection_params?.name || null }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// Extract the /in/<slug> identifier from a LinkedIn profile URL.
export function identifierFromUrl(url) {
  const m = (url || "").match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? m[1] : null;
}
