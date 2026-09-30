import assert from "node:assert/strict";
import { test, describe } from "node:test";
import crypto from "node:crypto";

const { POST: stripeWebhook } = await import("@/app/api/stripe/webhook/route");
const { POST: resendWebhook } = await import("@/app/api/webhooks/resend/route");
const { GET: scheduler } = await import("@/app/api/cron/scheduler/route");
const { GET: jobScan, POST: manualJobScan } = await import("@/app/api/jobs/sync/route");
const { POST: approveCadence } = await import("@/app/api/cadence/approve/route");
const { POST: scout } = await import("@/app/api/scout/route");
const { getUserId } = await import("@/lib/auth");
const { stepDueAt } = await import("@/lib/durable");
const { claimOutcome } = await import("@/lib/dispatch");

describe("public v1 fail-closed paths", { concurrency: false }, () => {
  test("no Auth configuration never authenticates a request", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      assert.equal(await getUserId(), null);
      const response = await approveCadence(new Request("https://example.com/api/cadence/approve", { method: "POST" }));
      assert.equal(response.status, 401);
    } finally {
      if (url == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      if (key == null) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
    }
  });

  test("Stripe rejects unsigned events even when secret is missing", async () => {
    const prior = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const response = await stripeWebhook(new Request("https://example.com/api/stripe/webhook", {
        method: "POST", body: JSON.stringify({ id: "evt_fake", type: "checkout.session.completed" }),
      }));
      assert.equal(response.status, 401);
    } finally {
      if (prior == null) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = prior;
    }
  });

  test("Resend rejects unsigned events even when secret is missing", async () => {
    const prior = process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.RESEND_WEBHOOK_SECRET;
    try {
      const response = await resendWebhook(new Request("https://example.com/api/webhooks/resend", {
        method: "POST", body: JSON.stringify({ id: "evt_fake", type: "email.bounced" }),
      }));
      assert.equal(response.status, 401);
    } finally {
      if (prior == null) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = prior;
    }
  });

  test("signed Stripe and Resend events return retryable errors when Postgres is unavailable", async () => {
    const previous = {
      stripe: process.env.STRIPE_WEBHOOK_SECRET,
      resend: process.env.RESEND_WEBHOOK_SECRET,
      db: process.env.WORKER_DATABASE_URL,
    };
    process.env.STRIPE_WEBHOOK_SECRET = "stripe-test-secret";
    const key = Buffer.from("resend-test-secret");
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
    delete process.env.WORKER_DATABASE_URL;
    try {
      const stripeBody = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: { payment_status: "paid", metadata: { userId: "11111111-1111-4111-8111-111111111111", plan: "plus" } } } });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${stripeBody}`).digest("hex");
      const stripeResponse = await stripeWebhook(new Request("https://example.com/api/stripe/webhook", {
        method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${signature}` }, body: stripeBody,
      }));
      assert.equal(stripeResponse.status, 503);

      const resendBody = JSON.stringify({ id: "evt_mail", type: "email.bounced", data: { to: ["a@example.com"] } });
      const signed = `msg_test.${timestamp}.${resendBody}`;
      const resendSignature = crypto.createHmac("sha256", key).update(signed).digest("base64");
      const resendResponse = await resendWebhook(new Request("https://example.com/api/webhooks/resend", {
        method: "POST", headers: { "svix-id": "msg_test", "svix-timestamp": String(timestamp), "svix-signature": `v1,${resendSignature}` }, body: resendBody,
      }));
      assert.equal(resendResponse.status, 503);
    } finally {
      if (previous.stripe == null) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previous.stripe;
      if (previous.resend == null) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = previous.resend;
      if (previous.db == null) delete process.env.WORKER_DATABASE_URL; else process.env.WORKER_DATABASE_URL = previous.db;
    }
  });

  test("scheduler and global scan require a cron secret", async () => {
    const prior = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const get = new Request("https://example.com/api/jobs/sync");
      const post = new Request("https://example.com/api/jobs/sync", { method: "POST" });
      assert.equal((await scheduler(get)).status, 401);
      assert.equal((await jobScan(get)).status, 401);
      assert.equal((await manualJobScan(post)).status, 401);
    } finally {
      if (prior == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prior;
    }
  });

  test("scout rejects invalid input before provider or database access", async () => {
    const response = await scout(new Request("https://example.com/api/scout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl: "https://example.com/not-linkedin" }),
    }));
    assert.equal(response.status, 400);
  });
});

describe("outreach scheduling and claim outcomes", () => {
  test("steps are due relative to approval, never to generation", () => {
    const approvedAt = "2026-09-10T12:00:00.000Z";
    const step = { day: 2 };
    assert.equal(stepDueAt({ approvalStatus: "draft", createdAt: "2026-09-01T00:00:00.000Z" }, step), null);
    assert.equal(stepDueAt({ approvalStatus: "approved", approvedAt: null }, step), null);
    assert.equal(stepDueAt({ approvalStatus: "approved", approvedAt }, step).toISOString(), "2026-09-12T12:00:00.000Z");
    assert.equal(stepDueAt({ approvalStatus: "approved", approvedAt }, { day: "soon" }), null);
  });

  test("only a started provider call leaves a claimed step uncertain", () => {
    assert.equal(claimOutcome(new Error("No email for this contact"), false), "pending");
    assert.equal(claimOutcome(Object.assign(new Error("cap"), { code: "daily_cap" }), false), "pending");
    assert.equal(claimOutcome(new Error("socket hang up"), true), "uncertain");
    assert.equal(claimOutcome(Object.assign(new Error("unrecorded"), { code: "delivery_uncertain" }), false), "uncertain");
  });
});
