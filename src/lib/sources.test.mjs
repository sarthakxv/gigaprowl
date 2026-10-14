import assert from "node:assert/strict";
import { test } from "node:test";
import { balanceBySource } from "@/lib/sources";

const jobs = (source, n) => Array.from({ length: n }, (_, i) => ({ source, sourceId: `${source}_${i}` }));

test("a capped feed keeps every source when one source dominates the scan", () => {
  const scan = [...jobs("remotive", 2), ...jobs("adzuna", 50), ...jobs("greenhouse", 50), ...jobs("lever", 1)];
  const feed = balanceBySource(scan, 10);
  assert.equal(feed.length, 10);
  const count = (source) => feed.filter((j) => j.source === source).length;
  assert.equal(count("remotive"), 2);
  assert.equal(count("lever"), 1);
  assert.equal(count("adzuna") + count("greenhouse"), 7);
  assert.ok(Math.abs(count("adzuna") - count("greenhouse")) <= 1);
});

test("balancing keeps each source's own order and never exceeds the input", () => {
  const scan = [...jobs("a", 3), ...jobs("b", 1)];
  assert.deepEqual(balanceBySource(scan, 100).map((j) => j.sourceId), ["a_0", "b_0", "a_1", "a_2"]);
  assert.deepEqual(balanceBySource([], 10), []);
});
