// Shared app constants. Import these instead of hardcoding URLs, TTLs, or KV keys.
export const PRODUCTION_APP_URL = "https://gigaprowl.vercel.app";
export const LOCAL_APP_URL = "http://localhost:3000";

export const SESSION_COOKIE = "prowl_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
export const DEV_SESSION_SECRET = "prowl-dev-secret";

export const DAY_MS = 86_400_000;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
export const GMAIL_SCOPES = [GMAIL_COMPOSE_SCOPE, "openid", "email"];
export const GMAIL_OAUTH_STATE_TTL_SEC = 600;
export const GMAIL_TOKEN_VERSION = 1;
export const GMAIL_CONNECT_CALLBACK_PATH = "/api/connect/google/callback";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export const CAP_LINKEDIN_PER_DAY_DEFAULT = 20;
export const CAP_EMAIL_PER_DAY_DEFAULT = 50;
// API routes are capped at 60 seconds. Keep the lease longer than the route so
// an in-flight worker cannot overlap a second dispatch after its lock expires.
export const OUTREACH_LOCK_TTL_SEC = 120;
export const SCHEDULER_PER_USER_CAP = 30;
export const SCHEDULER_EMAIL_CAP = 40;
export const SCHEDULER_TIME_BUDGET_MS = 50_000;
export const SCHEDULER_FAILURE_CAP = 50;

export const TOKEN_TTL_SEC = {
  verify: 60 * 60 * 24 * 3,
  reset: 60 * 60,
};

export const RESEND_TEST_FROM = "Gigaprowl <onboarding@resend.dev>";

export const kvKeys = {
  oauthGoogle: (token) => `prowl:oauth:google:${token}`,
  token: (token) => `prowl:tok:${token}`,
  suppress: (email) => `prowl:suppress:${email}`,
  rate: (kind, userId, day) => `prowl:rate:${kind}:${userId}:${day}`,
  rateLimit: (bucket, id, win) => `prowl:rl:${bucket}:${id}:${win}`,
  user: (email) => `prowl:user:${email}`,
  uidToEmail: (userId) => `prowl:uid2email:${userId}`,
  users: "prowl:users",
  userState: (userId) => `prowl:u:${userId}`,
  jobs: "prowl:jobs",
  linkedInOwner: (accountId) => `prowl:liowner:${accountId}`,
  pitch: (slug) => `prowl:pitch:${slug}`,
  lockOutreach: (userId, cadenceId, stepIndex) => `prowl:lock:outreach:${userId}:${cadenceId}:${stepIndex}`,
  mailEvent: (emailId) => `prowl:mailevt:${emailId}`,
  scoutProfile: (id) => `prowl:scout:uprofile:v2:${id}`,
  scoutLeads: "prowl:scout:leads",
  scoutLead: (email) => `prowl:scout:lead:${email}`,
};

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
}

export function appUrl() {
  const env = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (env) return env;
  return isProductionRuntime() ? PRODUCTION_APP_URL : LOCAL_APP_URL;
}

export function googleRedirectUri() {
  return `${appUrl()}${GMAIL_CONNECT_CALLBACK_PATH}`;
}

export function capLinkedInPerDay() {
  return Number(process.env.CAP_LINKEDIN_PER_DAY || CAP_LINKEDIN_PER_DAY_DEFAULT);
}

export function capEmailPerDay() {
  return Number(process.env.CAP_EMAIL_PER_DAY || CAP_EMAIL_PER_DAY_DEFAULT);
}
