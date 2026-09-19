import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  acquireLock,
  decodeKvResult,
  getUserState,
  releaseLock,
  updateUserState,
  DATA_DIR,
} from "@/lib/db";
import { OUTREACH_LOCK_TTL_SEC, kvKeys } from "@/lib/constants";

test("decodeKvResult returns objects that JSON.parse would throw on", () => {
  const obj = { profile: { name: "Ada" } };
  assert.throws(() => JSON.parse(obj));
  assert.deepEqual(decodeKvResult(obj).profile, { name: "Ada" });
});

test("decodeKvResult parses JSON strings and double-encoded JSON", () => {
  const inner = { profile: { name: "Ada" } };
  assert.deepEqual(decodeKvResult(JSON.stringify(inner)), inner);
  assert.deepEqual(decodeKvResult(JSON.stringify(JSON.stringify(inner))), inner);
});

test("decodeKvResult keeps a plain email string", () => {
  assert.equal(decodeKvResult("ada@example.com"), "ada@example.com");
  assert.equal(decodeKvResult(JSON.stringify("ada@example.com")), "ada@example.com");
});

test("getUserState round-trips a profile without dropping nested defaults", {
  skip: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
}, async () => {
  const id = "user_test_profile_roundtrip";
  const file = path.join(DATA_DIR, `prowl_u_${id}.json`);
  try {
    await updateUserState(id, (s) => {
      s.profile = { name: "Ada", skills: ["go"], topSkills: ["go"], roles: ["Engineer"] };
    });
    const s = await getUserState(id);
    assert.equal(s.profile.name, "Ada");
    assert.equal(s.media.facePhoto, null);
    assert.equal(s.connections.gmail, null);
    assert.equal(s.settings.outreachMode, "manual");
  } finally {
    try { fs.unlinkSync(file); } catch {}
  }
});

test("outreach locks are owner-bound and outlive the route deadline", {
  skip: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
}, async () => {
  assert.ok(OUTREACH_LOCK_TTL_SEC > 60);
  const key = kvKeys.lockOutreach("lock_user", "cadence", 0);
  const owner = await acquireLock(key);
  try {
    assert.ok(owner);
    assert.equal(await acquireLock(key), null);
    assert.equal(await releaseLock(key, "wrong-owner"), false);
    assert.equal(await acquireLock(key), null);
    assert.equal(await releaseLock(key, owner), true);
    const nextOwner = await acquireLock(key);
    assert.ok(nextOwner);
    assert.notEqual(nextOwner, owner);
    assert.equal(await releaseLock(key, nextOwner), true);
  } finally {
    await releaseLock(key, owner);
  }
});
