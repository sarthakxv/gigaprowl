import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeKvResult, getUserState } from "@/lib/db";

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

test("durable state rejects an unverified legacy user identifier", async () => {
  await assert.rejects(() => getUserState("user_test_profile_roundtrip"), /verified user UUID/);
});
