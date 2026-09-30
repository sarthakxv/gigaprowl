import assert from "node:assert/strict";
import { mock, test, describe, before } from "node:test";
import {
  PRODUCTION_APP_URL, GMAIL_COMPOSE_SCOPE, GMAIL_TOKEN_VERSION,
  GOOGLE_AUTH_URL, GMAIL_CONNECT_CALLBACK_PATH,
} from "@/lib/constants";

const KEY = "a".repeat(64);
before(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = KEY;
  process.env.APP_URL = PRODUCTION_APP_URL;
});

const {
  gmailEnabled, googleAuthUrl, redirectUri, oauthAppBase, encryptRefreshToken,
  decryptRefreshToken, parseEncryptionKey, isLegacyGmailConnection,
  publicGmailConnection, gmailUsable, hasGmailComposeScope, buildRaw,
  encodeHeaderValue, assertValidRecipient, exchangeCode, GmailError,
  createGoogleOAuthState, consumeGoogleOAuthState, classifyGoogleError,
  sendGmail,
} = await import("@/lib/gmail");
const { cronUnauthorized } = await import("@/lib/cron-auth");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Gmail provider boundary", { concurrency: false }, () => {
  test("configuration and OAuth scopes are separate from app sign-in", () => {
    assert.equal(gmailEnabled(), true);
    const url = new URL(googleAuthUrl("nonce123"));
    assert.equal(redirectUri(), `${PRODUCTION_APP_URL}${GMAIL_CONNECT_CALLBACK_PATH}`);
    assert.equal(oauthAppBase(), PRODUCTION_APP_URL);
    assert.equal(url.origin + url.pathname, GOOGLE_AUTH_URL);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("state"), "nonce123");
    assert.ok(url.searchParams.get("scope").split(" ").includes(GMAIL_COMPOSE_SCOPE));
  });

  test("refresh tokens are encrypted and never exposed in public connection data", () => {
    const blob = encryptRefreshToken("refresh-plain");
    assert.equal(blob.version, GMAIL_TOKEN_VERSION);
    assert.equal(decryptRefreshToken(blob), "refresh-plain");
    assert.notEqual(blob.ciphertext, Buffer.from("refresh-plain").toString("base64"));
    const connection = { email: "me@gmail.com", encryptedRefreshToken: blob, status: "connected" };
    assert.equal(publicGmailConnection(connection).email, "me@gmail.com");
    assert.equal("encryptedRefreshToken" in publicGmailConnection(connection), false);
    assert.equal(gmailUsable(connection), true);
    assert.equal(isLegacyGmailConnection({ email: "me@gmail.com", refreshToken: "plain" }), true);
    assert.throws(() => decryptRefreshToken({ version: 1 }), GmailError);
    assert.throws(() => parseEncryptionKey("short"), GmailError);
  });

  test("MIME encoding rejects header injection and bad recipients", () => {
    const raw = buildRaw({ from: "me@x.com", fromName: "José", to: "you@x.com", subject: "Hi\r\nBcc: evil@x.com", body: "hello" });
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    assert.ok(!mime.includes("\r\nBcc:"));
    assert.equal(encodeHeaderValue("Hello"), "Hello");
    assert.throws(() => assertValidRecipient("not-an-email"), GmailError);
  });

  test("OAuth token exchange rejects missing permission and unverified identity", async (t) => {
    let scenario = "happy";
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        if (scenario === "no_refresh") return jsonResponse({ access_token: "at", scope: `${GMAIL_COMPOSE_SCOPE} openid email` });
        if (scenario === "no_scope") return jsonResponse({ refresh_token: "rt", access_token: "at", scope: "openid email" });
        return jsonResponse({ refresh_token: "rt", access_token: "at", scope: `${GMAIL_COMPOSE_SCOPE} openid email` });
      }
      if (String(url).includes("userinfo")) return jsonResponse({ sub: "sub-1", email: "user@gmail.com", email_verified: scenario !== "unverified" });
      throw new Error("Unexpected fetch");
    });
    t.after(() => fetchMock.mock.restore());
    scenario = "no_refresh";
    await assert.rejects(() => exchangeCode("code-1"), (e) => e.code === "no_refresh");
    scenario = "no_scope";
    await assert.rejects(() => exchangeCode("code-2"), (e) => e.code === "insufficient_scope");
    scenario = "unverified";
    await assert.rejects(() => exchangeCode("code-3"), (e) => e.code === "unverified");
    scenario = "happy";
    const grant = await exchangeCode("code-4");
    assert.equal(grant.refreshToken, "rt");
    assert.ok(hasGmailComposeScope(grant.grantedScopes.join(" ")));
  });

  test("OAuth state is single-use even when consumed concurrently", async () => {
    const token = await createGoogleOAuthState("user_abc", "session-a");
    assert.equal(await consumeGoogleOAuthState(token, "session-b"), null);
    const concurrent = await createGoogleOAuthState("user_abc", "session-a");
    const results = await Promise.all([
      consumeGoogleOAuthState(concurrent, "session-a"),
      consumeGoogleOAuthState(concurrent, "session-a"),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
  });

  test("uncertain Gmail delivery is attempted only once", async (t) => {
    let sends = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return jsonResponse({ access_token: "at" });
      sends++;
      throw new TypeError("response lost");
    });
    t.after(() => fetchMock.mock.restore());
    await assert.rejects(
      () => sendGmail({ refreshToken: "rt", from: "me@example.com", to: "you@example.com", subject: "Hello", body: "Hi" }),
      (error) => error instanceof GmailError && error.code === "delivery_uncertain" && !error.retryable,
    );
    assert.equal(sends, 1);
  });

  test("cron fails closed without a secret", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal(cronUnauthorized({ headers: { get: () => null } }), true);
    process.env.CRON_SECRET = "s3cret";
    assert.equal(cronUnauthorized({ headers: { get: () => "Bearer s3cret" } }), false);
    assert.equal(cronUnauthorized({ headers: { get: () => "Bearer nope" } }), true);
    if (previous == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  });

  test("Google errors classify permanent and transient failures", () => {
    assert.equal(classifyGoogleError(400, { error: "invalid_grant" }, "fail").reauth, true);
    assert.equal(classifyGoogleError(429, {}, "rate").retryable, true);
  });
});
