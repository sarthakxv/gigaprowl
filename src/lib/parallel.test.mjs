import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { parallelEnabled, runParallelTask } from "@/lib/parallel";
import { getHiringSignal } from "@/lib/signals";
import { getRoleResearch } from "@/lib/research";

const realFetch = globalThis.fetch;
const ENV_KEYS = ["PARALLEL_API_KEY", "ANTHROPIC_API_KEY", "NODE_ENV"];
let savedEnv;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function stubFetch(...responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch to ${url}`);
    return next;
  };
  return calls;
}

// Every test starts keyless and non-production, whatever the outer shell exports.
beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  delete process.env.PARALLEL_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const task = {
  input: { company_name: "Acme" },
  outputSchema: { type: "object", properties: { summary: { type: "string" } } },
  processor: "base",
  timeoutMs: 1000,
};

test("parallelEnabled follows PARALLEL_API_KEY", () => {
  assert.equal(parallelEnabled(), false);
  process.env.PARALLEL_API_KEY = "key";
  assert.equal(parallelEnabled(), true);
});

test("runParallelTask creates a run, then returns the structured result content", async () => {
  process.env.PARALLEL_API_KEY = "key";
  const inputSchema = { type: "object", required: ["company_name"] };
  const calls = stubFetch(
    json({ run_id: "run_1" }),
    json({ output: { content: { summary: "hiring" } } }),
  );
  const content = await runParallelTask({ ...task, inputSchema });
  assert.deepEqual(content, { summary: "hiring" });

  const [create, result] = calls;
  assert.equal(create.url, "https://api.parallel.ai/v1/tasks/runs");
  assert.equal(create.init.method, "POST");
  assert.equal(create.init.headers["x-api-key"], "key");
  const sent = JSON.parse(create.init.body);
  assert.deepEqual(sent.input, { company_name: "Acme" });
  assert.equal(sent.processor, "base");
  assert.deepEqual(sent.task_spec.input_schema, { type: "json", json_schema: inputSchema });
  assert.deepEqual(sent.task_spec.output_schema, { type: "json", json_schema: task.outputSchema });
  assert.equal(result.url, "https://api.parallel.ai/v1/tasks/runs/run_1/result");
  assert.equal(result.init.headers["x-api-key"], "key");
});

test("runParallelTask leaves input_schema out when none is given", async () => {
  process.env.PARALLEL_API_KEY = "key";
  const calls = stubFetch(json({ run_id: "run_2" }), json({ output: { content: { summary: "ok" } } }));
  await runParallelTask(task);
  assert.equal("input_schema" in JSON.parse(calls[0].init.body).task_spec, false);
});

test("runParallelTask throws when the create call fails", async () => {
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({ error: "bad key" }, 401));
  await assert.rejects(() => runParallelTask(task), /parallel create 401/);
});

test("runParallelTask throws when create returns no run_id", async () => {
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({}));
  await assert.rejects(() => runParallelTask(task), /no run_id/);
});

test("runParallelTask throws when the result call fails", async () => {
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({ run_id: "run_3" }), json({}, 500));
  await assert.rejects(() => runParallelTask(task), /parallel result 500/);
});

test("runParallelTask throws when the result has no structured output", async () => {
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({ run_id: "run_4" }), json({ output: { content: "plain text" } }));
  await assert.rejects(() => runParallelTask(task), /no structured output/);
});

// ---- callers: a wiring mistake here would fail silently into the fallback ----

test("getHiringSignal maps a Parallel result into a signal", async () => {
  process.env.PARALLEL_API_KEY = "key";
  const calls = stubFetch(
    json({ run_id: "run_s" }),
    json({ output: { content: { is_hiring: "yes", open_roles: "7", recent_event: "raised a Series B", summary: "Scaling the platform team." } } }),
  );
  const signal = await getHiringSignal("Acme");
  assert.equal(signal.source, "parallel");
  assert.equal(signal.company, "Acme");
  assert.equal(signal.hiring, true);
  assert.equal(signal.openRoles, 7);
  assert.equal(signal.event, "raised a Series B");
  assert.equal(signal.intensity, 0.95);
  assert.equal(signal.summary, "Scaling the platform team.");

  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.input, { company_name: "Acme" });
  assert.deepEqual(sent.task_spec.input_schema.json_schema.required, ["company_name"]);
  assert.deepEqual(sent.task_spec.output_schema.json_schema.required, ["is_hiring", "open_roles", "recent_event", "summary"]);
});

test("getHiringSignal reads 'none' and 'no' as no hiring surge", async () => {
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(
    json({ run_id: "run_n" }),
    json({ output: { content: { is_hiring: "no", open_roles: "0", recent_event: "none", summary: "" } } }),
  );
  const signal = await getHiringSignal("Quietco");
  assert.equal(signal.source, "parallel");
  assert.equal(signal.hiring, false);
  assert.equal(signal.event, null);
  assert.equal(signal.intensity, 0);
  assert.match(signal.summary, /No strong hiring surge/);
});

test("getHiringSignal falls back to the mock when Parallel fails", async (t) => {
  t.mock.method(console, "error", () => {});
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({ error: "down" }, 500));
  const signal = await getHiringSignal("Acme");
  assert.equal(signal.source, "mock");
  assert.equal(signal.company, "Acme");
});

test("getHiringSignal is keyless-safe and never calls the network without a key", async () => {
  stubFetch();
  const signal = await getHiringSignal("Acme");
  assert.equal(signal.source, "mock");
});

const profile = { name: "Ada", discipline: "design", topSkills: ["figma", "ux"], strengths: ["Led an onboarding redesign"], summary: "Product designer.", skills: ["figma"] };
const job = { title: "Product Designer", company: "Acme", description: "Design the product." };

test("getRoleResearch uses Parallel when keyed and caps ideas at three", async () => {
  process.env.PARALLEL_API_KEY = "key";
  const calls = stubFetch(
    json({ run_id: "run_r" }),
    json({ output: { content: {
      angle: "I would tighten your onboarding.",
      ideas: [1, 2, 3, 4].map((n) => ({ title: `Idea ${n}`, detail: `I would do thing ${n} for your team.` })),
      mockup_brief: "A clean onboarding screen.",
    } } }),
  );
  const research = await getRoleResearch(profile, job);
  assert.equal(research.source, "parallel");
  assert.equal(research.discipline, "design");
  assert.equal(research.angle, "I would tighten your onboarding.");
  assert.equal(research.ideas.length, 3);
  assert.equal(research.mockupBrief, "A clean onboarding screen.");

  const sent = JSON.parse(calls[0].init.body);
  assert.match(sent.input, /Acme/);
  assert.equal(typeof sent.input, "string");
  assert.equal("input_schema" in sent.task_spec, false);
  assert.deepEqual(sent.task_spec.output_schema.json_schema.required, ["angle", "ideas", "mockup_brief"]);
});

test("getRoleResearch falls back when Parallel fails", async (t) => {
  t.mock.method(console, "warn", () => {});
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({ error: "down" }, 500));
  const research = await getRoleResearch(profile, job);
  assert.equal(research.source, "template");
  assert.ok(research.angle);
});

test("getRoleResearch falls back when the Parallel payload has no ideas array", async (t) => {
  t.mock.method(console, "warn", () => {});
  process.env.PARALLEL_API_KEY = "key";
  stubFetch(json({ run_id: "run_b" }), json({ output: { content: { angle: "I would help." } } }));
  const research = await getRoleResearch(profile, job);
  assert.equal(research.source, "template");
});
