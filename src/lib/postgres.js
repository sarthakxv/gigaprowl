import postgres from "postgres";

let appClient;
let workerClient;

function connect(variable) {
  const url = process.env[variable];
  if (!url) throw new Error(`${variable} is required for durable storage`);
  return postgres(url, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: process.env.NODE_ENV === "production" ? "require" : undefined,
  });
}

export function appDb() {
  appClient ||= connect("DATABASE_URL");
  return appClient;
}

export function workerDb() {
  workerClient ||= connect("WORKER_DATABASE_URL");
  return workerClient;
}

export async function withUser(userId, fn) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || "")) {
    throw new Error("A verified user UUID is required");
  }
  return appDb().begin(async (sql) => {
    await sql`select set_config('app.user_id', ${userId}, true)`;
    return fn(sql);
  });
}
