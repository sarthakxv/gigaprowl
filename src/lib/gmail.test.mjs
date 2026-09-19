import assert from "node:assert/strict";
import { mock, test, describe, before } from "node:test";
import fs from "node:fs";

import {
  PRODUCTION_APP_URL,
  GMAIL_COMPOSE_SCOPE,
  GMAIL_OAUTH_STATE_TTL_SEC,
  GMAIL_TOKEN_VERSION,
  GOOGLE_AUTH_URL,
  GMAIL_CONNECT_CALLBACK_PATH,
  kvKeys,
} from "@/lib/constants";
import { getUserState, kvDel, kvSet, updateUserState } from "@/lib/db";
import { createSessionToken, getSessionBinding } from "@/lib/auth";

const KEY = "a".repeat(64);

before(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = KEY;
  process.env.APP_URL = PRODUCTION_APP_URL;
  delete process.env.VERCEL;
});

const {
  gmailEnabled,
  googleAuthUrl,
  redirectUri,
  oauthAppBase,
  encryptRefreshToken,
  decryptRefreshToken,
  parseEncryptionKey,
  isLegacyGmailConnection,
  publicGmailConnection,
  gmailUsable,
  hasGmailComposeScope,
  buildRaw,
  encodeHeaderValue,
  assertValidRecipient,
  exchangeCode,
  GmailError,
  createGoogleOAuthState,
  consumeGoogleOAuthState,
  classifyGoogleError,
  sendGmail,
  plaintextRefreshTokenFor,
  disconnectGmail,
  refreshTokenFromConnection,
} = await import("@/lib/gmail");
const { cronUnauthorized } = await import("@/lib/cron-auth");
const { dispatchStep } = await import("@/lib/dispatch");
const { GET: gmailCallback } = await import("@/app/api/connect/google/callback/route");
const { GET: gmailHealth } = await import("@/app/api/connect/google/health/route");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("gmail integration", { concurrency: false }, () => {
  test("session bindings represent a valid signed session without storing its cookie", () => {
    const token = createSessionToken("user_abc");
    const req = { cookies: { get: () => ({ value: token }) } };
    const binding = getSessionBinding(req);
    assert.ok(binding);
    assert.notEqual(binding, token);
    assert.equal(getSessionBinding({ cookies: { get: () => ({ value: `${token}tampered` }) } }), null);
  });

  test("gmailEnabled requires client id, secret, and encryption key", () => {
    const prev = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "";
    assert.equal(gmailEnabled(), false);
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = prev;
    assert.equal(gmailEnabled(), true);
  });

  test("OAuth URL uses canonical callback, offline access, account selection, and compose scope", () => {
    const url = new URL(googleAuthUrl("nonce123"));
    assert.equal(redirectUri(), `${PRODUCTION_APP_URL}${GMAIL_CONNECT_CALLBACK_PATH}`);
    assert.equal(oauthAppBase(), PRODUCTION_APP_URL);
    assert.equal(url.origin + url.pathname, GOOGLE_AUTH_URL);
    assert.equal(url.searchParams.get("redirect_uri"), `${PRODUCTION_APP_URL}${GMAIL_CONNECT_CALLBACK_PATH}`);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent select_account");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("state"), "nonce123");
    const scopes = url.searchParams.get("scope").split(" ");
    assert.ok(scopes.includes(GMAIL_COMPOSE_SCOPE));
    assert.ok(scopes.includes("openid"));
    assert.ok(scopes.includes("email"));
    assert.ok(!scopes.includes("profile"));
  });

  test("production fallback APP_URL is the canonical Vercel domain", () => {
    const prev = process.env.APP_URL;
    const prevEnv = process.env.NODE_ENV;
    delete process.env.APP_URL;
    process.env.NODE_ENV = "production";
    assert.equal(oauthAppBase(), PRODUCTION_APP_URL);
    process.env.APP_URL = prev;
    process.env.NODE_ENV = prevEnv;
  });

  test("AES-256-GCM round-trips a refresh token and stores version/iv/tag/ciphertext", () => {
    const blob = encryptRefreshToken("refresh-plain");
    assert.equal(blob.version, GMAIL_TOKEN_VERSION);
    assert.ok(blob.iv && blob.tag && blob.ciphertext);
    assert.equal(decryptRefreshToken(blob), "refresh-plain");
    assert.notEqual(blob.ciphertext, Buffer.from("refresh-plain").toString("base64"));
  });

  test("legacy plaintext connections require reconnect and are not usable", () => {
    const legacy = { email: "a@b.com", refreshToken: "plain", connectedAt: "2020-01-01" };
    assert.equal(isLegacyGmailConnection(legacy), true);
    const pub = publicGmailConnection(legacy);
    assert.equal(pub.reconnectRequired, true);
    assert.equal(pub.status, "reauth_required");
    assert.equal(pub.email, "a@b.com");
    assert.equal("refreshToken" in pub, false);
    assert.equal(gmailUsable(legacy), false);
  });

  test("connected encrypted records expose only public fields", () => {
    const blob = encryptRefreshToken("r");
    const gmail = { email: "me@gmail.com", encryptedRefreshToken: blob, status: "connected", connectedAt: "t", lastValidatedAt: "t2" };
    const pub = publicGmailConnection(gmail);
    assert.deepEqual(Object.keys(pub).sort(), ["connectedAt", "email", "lastValidatedAt", "reconnectRequired", "status"].sort());
    assert.equal(pub.reconnectRequired, false);
    assert.equal(gmailUsable(gmail), true);
  });

  test("transient connection errors remain usable without requiring reconnect", () => {
    const blob = encryptRefreshToken("r");
    const gmail = { email: "me@gmail.com", encryptedRefreshToken: blob, status: "error", lastErrorCode: "transient" };
    assert.equal(publicGmailConnection(gmail).reconnectRequired, false);
    assert.equal(gmailUsable(gmail), true);
    assert.equal(refreshTokenFromConnection(gmail), "r");
  });

  test("decrypt rejects malformed blobs", () => {
    assert.throws(() => decryptRefreshToken({ version: 1 }), GmailError);
    assert.throws(() => parseEncryptionKey("short"), GmailError);
  });

  test("MIME encoding handles unicode and strips header injection", () => {
    const raw = buildRaw({ from: "me@x.com", fromName: "José", to: "you@x.com", subject: "Hi\r\nBcc: evil@x.com", body: "hello" });
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    assert.ok(mime.includes("=?UTF-8?B?"));
    assert.ok(!mime.includes("\r\nBcc:"));
    assert.equal(encodeHeaderValue("Hello"), "Hello");
    assert.throws(() => assertValidRecipient("not-an-email"), GmailError);
    assert.throws(() => assertValidRecipient("a@b.com\r\nCc: x@y.com"), GmailError);
  });

  test("exchangeCode rejects missing refresh token, missing scope, and unverified email", async (t) => {
    let scenario = "happy";
    const fetchMock = mock.method(globalThis, "fetch", async (url, opts) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token")) {
        const body = String(opts.body);
        assert.ok(body.includes("grant_type=authorization_code"));
        assert.ok(body.includes(encodeURIComponent(redirectUri())));
        if (scenario === "no_refresh") {
          return jsonResponse({ access_token: "at", scope: `${GMAIL_COMPOSE_SCOPE} openid email` });
        }
        if (scenario === "no_scope") {
          return jsonResponse({ refresh_token: "rt", access_token: "at", scope: "openid email" });
        }
        return jsonResponse({ refresh_token: "rt", access_token: "at", scope: `${GMAIL_COMPOSE_SCOPE} openid email` });
      }
      if (u.includes("userinfo")) {
        if (scenario === "unverified") {
          return jsonResponse({ sub: "sub-1", email: "user@gmail.com", email_verified: false });
        }
        return jsonResponse({ sub: "sub-1", email: "user@gmail.com", email_verified: true });
      }
      throw new Error(`unexpected fetch ${u}`);
    });
    t.after(() => fetchMock.mock.restore());

    scenario = "no_refresh";
    await assert.rejects(() => exchangeCode("code-1"), (e) => e instanceof GmailError && e.code === "no_refresh");
    scenario = "no_scope";
    await assert.rejects(() => exchangeCode("code-2"), (e) => e instanceof GmailError && e.code === "insufficient_scope");
    scenario = "unverified";
    await assert.rejects(() => exchangeCode("code-3"), (e) => e instanceof GmailError && e.code === "unverified");
    scenario = "happy";
    const grant = await exchangeCode("code-4");
    assert.equal(grant.refreshToken, "rt");
    assert.equal(grant.email, "user@gmail.com");
    assert.equal(grant.googleSub, "sub-1");
    assert.ok(hasGmailComposeScope(grant.grantedScopes.join(" ")));
  });

  test("OAuth state is session-bound, atomic, single-use, and rejects replay", async () => {
    const token = await createGoogleOAuthState("user_abc", "session-a");
    assert.equal(await consumeGoogleOAuthState(token, "session-b"), null);

    const concurrentToken = await createGoogleOAuthState("user_abc", "session-a");
    const results = await Promise.all([
      consumeGoogleOAuthState(concurrentToken, "session-a"),
      consumeGoogleOAuthState(concurrentToken, "session-a"),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const rec = results.find(Boolean);
    assert.equal(rec.userId, "user_abc");
    assert.equal(await consumeGoogleOAuthState(concurrentToken, "session-a"), null);
    assert.equal(await consumeGoogleOAuthState("", "session-a"), null);
    assert.equal(await consumeGoogleOAuthState(concurrentToken, ""), null);
  });

  test("OAuth state rejects records older than ten minutes", async () => {
    const token = "expired-state-test";
    await kvSet(kvKeys.oauthGoogle(token), {
      userId: "user_abc",
      sessionBinding: "session-a",
      at: Date.now() - (GMAIL_OAUTH_STATE_TTL_SEC * 1000 + 1),
    });
    assert.equal(await consumeGoogleOAuthState(token, "session-a"), null);
  });

  test("OAuth callback rejects a missing session before consuming state", async () => {
    const sessionToken = createSessionToken("user_abc");
    const sessionReq = { cookies: { get: () => ({ value: sessionToken }) } };
    const sessionBinding = getSessionBinding(sessionReq);
    const state = await createGoogleOAuthState("user_abc", sessionBinding);
    const response = await gmailCallback({
      url: `${PRODUCTION_APP_URL}/api/connect/google/callback?code=code&state=${state}`,
      cookies: { get: () => undefined },
    });
    assert.equal(response.status, 307);
    assert.ok(response.headers.get("location").includes("connect=gmail_bad_state"));
    assert.equal((await consumeGoogleOAuthState(state, sessionBinding)).userId, "user_abc");
  });

  test("invalid_grant is a permanent reauth failure", () => {
    const e = classifyGoogleError(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }, "fail");
    assert.equal(e.reauth, true);
    assert.equal(e.retryable, false);
    assert.equal(e.code, "reauth_required");
  });

  test("non-mutating Google 429/5xx errors are retryable", () => {
    assert.equal(classifyGoogleError(429, {}, "rate").retryable, true);
    assert.equal(classifyGoogleError(503, {}, "down").retryable, true);
  });

  test("Gmail mutations are attempted once when delivery outcome is unknown", async (t) => {
    let gmailPosts = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return jsonResponse({ access_token: "at" });
      }
      gmailPosts++;
      throw new TypeError("response lost");
    });
    t.after(() => fetchMock.mock.restore());

    await assert.rejects(
      () => sendGmail({ refreshToken: "rt", from: "me@example.com", to: "you@example.com", subject: "Hello", body: "Hi" }),
      (e) => e instanceof GmailError && e.code === "delivery_uncertain" && !e.retryable,
    );
    assert.equal(gmailPosts, 1);
  });

  test("a Gmail 5xx response has an uncertain outcome and is not retried", async (t) => {
    let gmailPosts = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return jsonResponse({ access_token: "at" });
      gmailPosts++;
      return jsonResponse({ error: { status: "INTERNAL" } }, 503);
    });
    t.after(() => fetchMock.mock.restore());

    await assert.rejects(
      () => sendGmail({ refreshToken: "rt", from: "me@example.com", to: "you@example.com", subject: "Hello", body: "Hi" }),
      (e) => e instanceof GmailError && e.code === "delivery_uncertain",
    );
    assert.equal(gmailPosts, 1);
  });

  test("an uncertain delivery stops the cadence step from being sent again", async (t) => {
    const userId = "uncertain_delivery_user";
    const cadenceId = "uncertain_cadence";
    const encryptedRefreshToken = encryptRefreshToken("rt");
    await updateUserState(userId, (s) => {
      s.profile = { name: "Ada" };
      s.contacts = [{ id: "contact-1", email: "you@example.com" }];
      s.cadences = [{
        id: cadenceId,
        contactId: "contact-1",
        matchId: "match-1",
        company: "Example",
        jobTitle: "Engineer",
        steps: [{ channel: "email", subject: "Hello", body: "Hi", status: "pending" }],
      }];
      s.connections.gmail = { email: "me@example.com", encryptedRefreshToken, status: "connected" };
      s.settings.outreachMode = "automated";
    });

    let gmailPosts = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return jsonResponse({ access_token: "at" });
      gmailPosts++;
      throw new TypeError("response lost");
    });
    t.after(async () => {
      fetchMock.mock.restore();
      await kvDel(kvKeys.userState(userId));
      const day = new Date().toISOString().slice(0, 10);
      await kvDel(kvKeys.rate("email", userId, day));
    });

    await assert.rejects(
      () => dispatchStep(userId, cadenceId, 0),
      (e) => e instanceof GmailError && e.code === "delivery_uncertain",
    );
    assert.equal((await getUserState(userId)).cadences[0].steps[0].status, "uncertain");
    assert.deepEqual(await dispatchStep(userId, cadenceId, 0), { skipped: true, status: "uncertain" });
    assert.equal(gmailPosts, 1);
  });

  test("transient health failures preserve a usable Gmail connection", async (t) => {
    const userId = "transient_health_user";
    await updateUserState(userId, (s) => {
      s.connections.gmail = {
        email: "health@example.com",
        encryptedRefreshToken: encryptRefreshToken("rt"),
        status: "connected",
        lastErrorCode: null,
      };
    });
    const sessionToken = createSessionToken(userId);
    let profileCalls = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return jsonResponse({ access_token: "at" });
      profileCalls++;
      return jsonResponse({ error: { status: "UNAVAILABLE" } }, 503);
    });
    t.after(async () => {
      fetchMock.mock.restore();
      await kvDel(kvKeys.userState(userId));
    });

    const response = await gmailHealth({ cookies: { get: () => ({ value: sessionToken }) } });
    assert.equal(response.status, 502);
    assert.ok(profileCalls >= 1);
    const gmail = (await getUserState(userId)).connections.gmail;
    assert.equal(gmail.status, "connected");
    assert.equal(gmail.lastErrorCode, "transient");
    assert.equal(gmailUsable(gmail), true);
  });

  test("legacy refresh tokens are used for revocation and always removed locally", async (t) => {
    const userId = "legacy_disconnect_user";
    await updateUserState(userId, (s) => {
      s.connections.gmail = { email: "legacy@example.com", refreshToken: "legacy-plain-token" };
    });
    assert.equal(await plaintextRefreshTokenFor({ refreshToken: "legacy-plain-token" }), "legacy-plain-token");
    let revokedToken;
    const fetchMock = mock.method(globalThis, "fetch", async (url, opts) => {
      assert.ok(String(url).includes("revoke"));
      revokedToken = new URLSearchParams(String(opts.body)).get("token");
      return new Response(null, { status: 200 });
    });
    t.after(() => fetchMock.mock.restore());
    await disconnectGmail(userId);
    assert.equal(revokedToken, "legacy-plain-token");
    assert.equal((await getUserState(userId)).connections.gmail, null);
    await kvDel(kvKeys.userState(userId));
  });

  test("cron requires authorization in production even when CRON_SECRET is missing", () => {
    const prevSecret = process.env.CRON_SECRET;
    const prevEnv = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL;
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL;
    const req = { headers: { get: () => null } };
    assert.equal(cronUnauthorized(req), true);
    process.env.CRON_SECRET = "s3cret";
    assert.equal(cronUnauthorized({ headers: { get: () => "Bearer s3cret" } }), false);
    assert.equal(cronUnauthorized({ headers: { get: () => "Bearer nope" } }), true);
    if (prevSecret == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prevSecret;
    process.env.NODE_ENV = prevEnv;
    if (prevVercel == null) delete process.env.VERCEL; else process.env.VERCEL = prevVercel;
  });

  test("dispatch does not import Resend", () => {
    const src = fs.readFileSync(new URL("./dispatch.js", import.meta.url), "utf8");
    assert.equal(/resend/i.test(src), false);
  });
});
