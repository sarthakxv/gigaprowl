import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url);

// Local stand-ins for the pre-existing Supabase Auth schema and API roles,
// followed by every migration in version order.
async function applyMigrations(db) {
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key);");
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
}

test("public-v1 migration enforces tenant RLS and provider deduplication", async () => {
  const db = new PGlite();
  try {
    await applyMigrations(db);
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

test("a Unipile account can be reconnected with a fresh correlation", async () => {
  const db = new PGlite();
  try {
    await applyMigrations(db);
    await db.query("insert into auth.users (id) values ($1)", [USER_A]);
    await db.exec("set role gigaprowl_worker");
    await db.query("insert into app.accounts (id, email) values ($1, 'a@example.com')", [USER_A]);
    for (const nonce of [new Uint8Array([1]), new Uint8Array([2])]) {
      await db.query("insert into app.unipile_correlations (nonce_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')", [nonce, USER_A]);
      const consumed = await db.query("update app.unipile_correlations set consumed_at = now(), account_id = 'acc_1' where nonce_hash = $1 and consumed_at is null", [nonce]);
      assert.equal(consumed.affectedRows, 1);
    }
    await db.query("insert into app.unipile_accounts (account_id, user_id) values ('acc_1', $1)", [USER_A]);
    await assert.rejects(
      () => db.query("insert into app.unipile_accounts (account_id, user_id) values ('acc_1', $1)", [USER_A]),
      /duplicate key/,
    );
  } finally {
    await db.close();
  }
});

test("surplus cadence steps can be removed without losing dispatch attempts", async () => {
  const db = new PGlite();
  try {
    await applyMigrations(db);
    await db.query("insert into auth.users (id) values ($1)", [USER_A]);
    await db.exec("set role gigaprowl_app");
    await db.exec("begin");
    await db.query("select set_config('app.user_id', $1, true)", [USER_A]);
    await db.query("insert into app.accounts (id, email) values ($1, 'a@example.com')", [USER_A]);
    await db.query("insert into app.cadences (id, user_id, data) values ('cad_1', $1, '{}')", [USER_A]);
    for (const index of [0, 1, 2, 3]) {
      await db.query("insert into app.cadence_steps (cadence_id, user_id, step_index, data) values ('cad_1', $1, $2, '{}')", [USER_A, index]);
    }
    await db.query("insert into app.dispatch_attempts (user_id, cadence_id, step_index, status) values ($1, 'cad_1', 3, 'failed')", [USER_A]);
    const removed = await db.query("delete from app.cadence_steps where cadence_id = 'cad_1' and step_index >= 3 and status in ('draft', 'pending')");
    assert.equal(removed.affectedRows, 1);
    assert.equal((await db.query("select count(*)::integer as n from app.dispatch_attempts")).rows[0].n, 1);
    await db.exec("commit");
  } finally {
    await db.close();
  }
});
