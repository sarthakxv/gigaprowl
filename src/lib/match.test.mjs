import assert from "node:assert/strict";
import { test } from "node:test";
import { rankJobs, scoreJob } from "@/lib/match";

const job = { title: "Senior Engineer", company: "Vercel", description: "react typescript", tags: ["react"] };

test("scoreJob does not throw on a sparse AI profile", () => {
  const profile = { name: "Ada", skills: ["react"] };
  const out = scoreJob(profile, job);
  assert.equal(typeof out.score, "number");
  assert.ok(Array.isArray(out.matchedSkills));
});

test("rankJobs does not throw on missing roles, jobs, or job title", () => {
  const profile = { name: "Ada", skills: ["react"], topSkills: ["react"] };
  const ranked = rankJobs(profile, [job, { company: "X" }, null], 0);
  assert.ok(ranked.length >= 1);
  assert.equal(rankJobs(profile, null).length, 0);
});
