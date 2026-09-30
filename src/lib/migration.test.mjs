import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

test("public-v1 migration enforces tenant RLS and provider deduplication", async () => {
  const db = new PGlite();
  try {
    // Local stand-ins for the pre-existing Supabase Auth schema and API roles.
    await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key);");
    const migration = readFileSync(new URL("../../supabase/migrations/20260924142722_public_v1_backend_foundation.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.query("insert into auth.users (id) values ($1), ($2)", [USER_A, USER_B]);
    await db.exec("set role gigaprowl_app");

    assert.equal((await db.query("select count(*)::integer as n from app.accounts")).rows[0].n, 0);
    for (const [id, email] of [[USER_A, "a@example.com"], [USER_B, "b@example.com"]]) {
      await db.exec("begin");
      await db.query("select set_config('app.user_id', $1, true)", [id]);
      await db.query("insert into app.accounts (id, email) values ($1, $2)", [id, email]);
      await db.query("insert into app.credit_accounts (user_id, balance) values ($1, 5)", [id]);
      await db.exec("commit");
    }

    await db.exec("begin");
    await db.query("select set_config('app.user_id', $1, true)", [USER_A]);
    const visible = await db.query("select id from app.accounts");
    assert.deepEqual(visible.rows.map((row) => row.id), [USER_A]);
    assert.equal((await db.query("update app.accounts set email = 'hacked@example.com' where id = $1", [USER_B])).affectedRows, 0);
    await assert.rejects(
      () => db.query("insert into app.profiles (user_id) values ($1)", [USER_B]),
      /row-level security policy/,
    );
    await db.exec("rollback");

    await db.exec("set role gigaprowl_worker");
    assert.equal((await db.query("select count(*)::integer as n from app.accounts")).rows[0].n, 2);
    await db.query("insert into app.provider_events (provider, event_id, event_type) values ('stripe', $1, 'invoice.paid') on conflict do nothing", ["evt_same"]);
    await db.query("insert into app.provider_events (provider, event_id, event_type) values ('stripe', $1, 'invoice.paid') on conflict do nothing", ["evt_same"]);
    assert.equal((await db.query("select count(*)::integer as n from app.provider_events")).rows[0].n, 1);
    await assert.rejects(
      () => db.query("update app.credit_accounts set balance = -1 where user_id = $1", [USER_A]),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});
