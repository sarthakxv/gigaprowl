// Parallel Task API (parallel.ai): create a task run, then block on its result.
// Shared by the hiring-signal lookup (signals.js) and role research (research.js).
// Throws on any failure so each caller can fall back its own way.

const PARALLEL_BASE = "https://api.parallel.ai/v1";
const CREATE_TIMEOUT_MS = 15000;

export const parallelEnabled = () => !!process.env.PARALLEL_API_KEY;

// Returns the structured `output.content` object of the finished run.
//   input        string or object sent as the task input
//   inputSchema  optional JSON schema describing an object `input`
//   outputSchema JSON schema the run's result must satisfy
//   processor    Parallel processor tier ("base", "core", ...)
//   timeoutMs    how long to wait for the result before giving up
export async function runParallelTask({ input, inputSchema, outputSchema, processor, timeoutMs }) {
  const headers = { "x-api-key": process.env.PARALLEL_API_KEY, "Content-Type": "application/json" };
  const createRes = await fetch(`${PARALLEL_BASE}/tasks/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input,
      processor,
      task_spec: {
        ...(inputSchema ? { input_schema: { type: "json", json_schema: inputSchema } } : {}),
        output_schema: { type: "json", json_schema: outputSchema },
      },
    }),
    signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
  });
  if (!createRes.ok) throw new Error(`parallel create ${createRes.status} ${(await createRes.text()).slice(0, 160)}`);
  const { run_id } = await createRes.json();
  if (!run_id) throw new Error("parallel create returned no run_id");

  // The result endpoint blocks server-side until the run completes.
  const resultRes = await fetch(`${PARALLEL_BASE}/tasks/runs/${run_id}/result`, {
    headers: { "x-api-key": headers["x-api-key"] },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resultRes.ok) throw new Error(`parallel result ${resultRes.status}`);
  const content = (await resultRes.json())?.output?.content;
  if (!content || typeof content !== "object") throw new Error("parallel returned no structured output");
  return content;
}
