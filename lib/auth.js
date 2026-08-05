// Sessions + password hashing. No external deps: scrypt + HMAC-signed cookies.
import crypto from "crypto";
import { getUserByEmail, saveUser, addUserId, uid } from "@/lib/db";

const SECRET =
  process.env.SESSION_SECRET ||
  process.env.KV_REST_API_TOKEN || // stable fallback in prod
  "prowl-dev-secret";
const COOKIE = "prowl_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ---------- passwords ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

// ---------- session tokens ----------
function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const { uid: userId, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return exp > Date.now() ? userId : null;
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearedSessionCookie() {
  return { ...sessionCookie(""), maxAge: 0 };
}

// Get authed userId from a route request. Returns null if not signed in.
export function getUserId(req) {
  return verifySessionToken(req.cookies.get(COOKIE)?.value);
}

// ---------- account ops ----------
export async function signup(email, password, name) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
  const existing = await getUserByEmail(email);
  if (existing) throw new Error("An account with this email already exists — log in instead");
  const user = {
    id: uid("user"),
    email: email.toLowerCase().trim(),
    name: (name || email.split("@")[0]).trim(),
    passHash: hashPassword(password),
    // Email verification is temporarily disabled. Keep the field true so
    // existing authorization and account-state code remains compatible.
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };
  await saveUser(user);
  await addUserId(user.id);
  return user;
}

// Mark a user's email as confirmed (called from the verify route).
export async function markEmailVerified(email) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  user.emailVerified = true;
  user.verifiedAt = new Date().toISOString();
  await saveUser(user);
  return user;
}

// Set a new password (called from the reset route).
export async function setUserPassword(email, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error("Password must be at least 8 characters");
  const user = await getUserByEmail(email);
  if (!user) throw new Error("Account not found");
  user.passHash = hashPassword(newPassword);
  user.passwordUpdatedAt = new Date().toISOString();
  await saveUser(user);
  return user;
}

export async function login(email, password) {
  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passHash)) throw new Error("Wrong email or password");
  await addUserId(user.id); // ensure pre-existing accounts land in the scheduler index
  return user;
}
