import crypto from "crypto";
import { withUser, workerDb } from "@/lib/postgres";

const EMPTY = {
  profile: null,
  media: { facePhoto: null, voiceSample: null },
  statusById: {},
  contacts: [],
  cadences: [],
  pitchRefs: [],
  applyKits: [],
  socialPosts: [],
  credits: { plan: "free", balance: 5, used: 0 },
  connections: { gmail: null, linkedin: null, linkedinExt: null },
  linkedinQueue: [],
  sends: [],
  settings: { outreachMode: "manual", emailStyle: "standard" },
};

const copy = () => structuredClone(EMPTY);
const rowsData = (rows) => rows.map((row) => row.data);

export async function ensureAccount(user) {
  if (!user?.id || !user?.email || !user?.email_confirmed_at) {
    throw new Error("A confirmed Supabase user is required");
  }
  return withUser(user.id, async (sql) => {
    await sql`
      insert into app.accounts (id, email, name)
      values (${user.id}, ${user.email.toLowerCase()}, ${user.user_metadata?.full_name || user.user_metadata?.name || null})
      on conflict (id) do update set email = excluded.email, updated_at = now()
    `;
    await sql`insert into app.credit_accounts (user_id, balance) values (${user.id}, 5) on conflict do nothing`;
    await sql`
      insert into app.credit_ledger (user_id, delta, reference, reason)
      values (${user.id}, 5, ${`welcome:${user.id}`}, 'welcome')
      on conflict (reference) do nothing
    `;
    return user.id;
  });
}

export async function getAccount(userId) {
  return withUser(userId, async (sql) => {
    const [row] = await sql`select id, email, name, created_at from app.accounts where id = ${userId}`;
    return row ? { id: row.id, email: row.email, name: row.name, emailVerified: true, createdAt: row.created_at } : null;
  });
}

export async function allAccountIds() {
  const rows = await workerDb()`select id from app.accounts`;
  return rows.map((row) => row.id);
}

export async function dueCadenceSteps(limit = 500) {
  return workerDb()`
    select step.user_id, step.cadence_id, step.step_index
    from app.cadence_steps as step
    join app.cadences as cadence on cadence.id = step.cadence_id and cadence.user_id = step.user_id
    where step.status = 'pending' and step.due_at <= now() and cadence.approval_status = 'approved'
    order by step.due_at, step.cadence_id, step.step_index
    limit ${limit}
  `;
}

async function readState(sql, userId) {
  const state = copy();
  const [profile] = await sql`select data, media from app.profiles where user_id = ${userId}`;
  if (profile) {
    state.profile = profile.data;
    state.media = { ...state.media, ...profile.media };
  }
  const [settings] = await sql`select outreach_mode, email_style from app.settings where user_id = ${userId}`;
  if (settings) state.settings = { outreachMode: settings.outreach_mode, emailStyle: settings.email_style };
  const [credits] = await sql`select plan, balance, used from app.credit_accounts where user_id = ${userId}`;
  if (credits) state.credits = { plan: credits.plan, balance: credits.balance, used: credits.used };

  const matches = await sql`select job_source_id, status from app.matches where user_id = ${userId}`;
  state.statusById = Object.fromEntries(matches.map((row) => [row.job_source_id, row.status]));
  state.contacts = rowsData(await sql`select data from app.contacts where user_id = ${userId} order by created_at`);
  const cadences = await sql`select id, approval_status, data from app.cadences where user_id = ${userId} order by created_at`;
  const steps = await sql`select cadence_id, step_index, data from app.cadence_steps where user_id = ${userId} order by step_index`;
  const byCadence = new Map();
  for (const step of steps) {
    if (!byCadence.has(step.cadence_id)) byCadence.set(step.cadence_id, []);
    byCadence.get(step.cadence_id)[step.step_index] = step.data;
  }
  state.cadences = cadences.map((row) => ({ ...row.data, approvalStatus: row.approval_status, steps: byCadence.get(row.id) || [] }));
  state.pitchRefs = rowsData(await sql`select reference as data from app.pitches where user_id = ${userId} and reference is not null order by created_at`);
  state.applyKits = rowsData(await sql`select data from app.apply_kits where user_id = ${userId} order by created_at`);
  state.socialPosts = rowsData(await sql`select data from app.social_posts where user_id = ${userId} order by created_at`);
  const integrations = await sql`select provider, data from app.integrations where user_id = ${userId}`;
  for (const row of integrations) state.connections[row.provider] = row.data;
  state.linkedinQueue = rowsData(await sql`select data from app.extension_actions where user_id = ${userId} order by created_at`);
  state.sends = rowsData(await sql`select data from app.sends where user_id = ${userId} order by created_at`);
  return state;
}

export async function readUserState(userId) {
  return withUser(userId, (sql) => readState(sql, userId));
}

export async function claimCadenceStep(userId, cadenceId, stepIndex) {
  return withUser(userId, async (sql) => {
    // Take the same tenant lock as mutateUserState so a concurrent state write
    // cannot overwrite this claim from a stale snapshot.
    const [account] = await sql`select id from app.accounts where id = ${userId} for update`;
    if (!account) return null;
    const [row] = await sql`
      update app.cadence_steps as step
      set status = 'dispatching',
          data = jsonb_set(step.data, '{status}', '"dispatching"'::jsonb)
      where step.user_id = ${userId} and step.cadence_id = ${cadenceId}
        and step.step_index = ${stepIndex} and step.status = 'pending'
        and exists (
          select 1 from app.cadences as cadence
          where cadence.id = step.cadence_id and cadence.user_id = ${userId}
            and cadence.approval_status = 'approved'
        )
      returning step.cadence_id
    `;
    if (!row) return null;
    const [attempt] = await sql`
      insert into app.dispatch_attempts (user_id, cadence_id, step_index, status)
      values (${userId}, ${cadenceId}, ${stepIndex}, 'reserved') returning id
    `;
    return attempt.id;
  });
}

export async function finishDispatchAttempt(userId, attemptId, status, errorCode = null) {
  if (!["sent", "drafted", "queued", "uncertain", "failed"].includes(status)) {
    throw new Error("Invalid dispatch outcome");
  }
  await withUser(userId, (sql) => sql`
    update app.dispatch_attempts set status = ${status}, error_code = ${errorCode}, updated_at = now()
    where id = ${attemptId} and user_id = ${userId} and status = 'reserved'
  `);
}

export async function mutateUserState(userId, fn, options = {}) {
  return withUser(userId, async (sql) => {
    // Serializes every state transition for this tenant, including credit spend.
    const [account] = await sql`select id from app.accounts where id = ${userId} for update`;
    if (!account) throw new Error("Account does not exist");
    if (options.hunt) {
      const { id, matchId } = options.hunt;
      const [inserted] = await sql`
        insert into app.hunts (id, user_id, job_source_id, kind, status)
        values (${id}, ${userId}, ${matchId}, 'full', 'completed')
        on conflict (user_id, job_source_id, kind) do nothing returning id
      `;
      if (!inserted) throw new Error("This job has already been hunted");
    }
    if (options.pitch) {
      const pitch = options.pitch;
      await sql`
        insert into app.pitches (slug, user_id, data, published)
        values (${pitch.slug}, ${userId}, ${sql.json(pitch)}, true)
      `;
    }
    const state = await readState(sql, userId);
    const snapshot = {
      profile: JSON.stringify(state.profile),
      media: JSON.stringify(state.media),
      settings: JSON.stringify(state.settings),
      matches: { ...state.statusById },
      connections: Object.fromEntries(Object.entries(state.connections).map(([key, value]) => [key, JSON.stringify(value)])),
    };
    for (const [name, id] of [
      ["contacts", (item) => item.id],
      ["cadences", (item) => item.id],
      ["pitchRefs", (item) => item.slug],
      ["applyKits", (item) => item.id],
      ["socialPosts", (item) => item.id],
      ["linkedinQueue", (item) => item.id],
      ["sends", (item) => item.id],
    ]) {
      snapshot[name] = new Map((state[name] || []).map((item) => [id(item), JSON.stringify(item)]));
    }
    snapshot.steps = new Map(state.cadences.map((item) => [item.id, {
      schedule: JSON.stringify([item.approvalStatus, item.approvedAt]),
      steps: (item.steps || []).map((step) => JSON.stringify(step)),
    }]));
    const unchanged = (name, id, item) => snapshot[name].get(id) === JSON.stringify(item);
    const oldCredits = { ...state.credits };
    const result = fn(state);

    if (state.profile && (snapshot.profile !== JSON.stringify(state.profile) || snapshot.media !== JSON.stringify(state.media))) await sql`
      insert into app.profiles (user_id, data, media) values (${userId}, ${sql.json(state.profile)}, ${sql.json(state.media)})
      on conflict (user_id) do update set data = excluded.data, media = excluded.media, version = app.profiles.version + 1, updated_at = now()
    `;
    if (snapshot.settings !== JSON.stringify(state.settings)) await sql`
      insert into app.settings (user_id, outreach_mode, email_style)
      values (${userId}, ${state.settings.outreachMode || "manual"}, ${state.settings.emailStyle || "standard"})
      on conflict (user_id) do update set outreach_mode = excluded.outreach_mode, email_style = excluded.email_style
    `;
    const delta = Number(state.credits.balance) - Number(oldCredits.balance);
    if (delta || state.credits.plan !== oldCredits.plan || state.credits.used !== oldCredits.used) {
      if (state.credits.balance < 0 || state.credits.used < 0) throw new Error("Insufficient credits");
      await sql`
        update app.credit_accounts set plan = ${state.credits.plan}, balance = ${state.credits.balance}, used = ${state.credits.used}
        where user_id = ${userId}
      `;
      if (delta) await sql`
        insert into app.credit_ledger (user_id, delta, reference, reason)
        values (${userId}, ${delta}, ${options.hunt ? `hunt:${userId}:${options.hunt.matchId}` : `transition:${crypto.randomUUID()}`}, ${delta < 0 ? "hunt" : "grant"})
      `;
    }

    for (const [jobId, status] of Object.entries(state.statusById || {})) {
      if (snapshot.matches[jobId] === status) continue;
      await sql`
        insert into app.matches (user_id, job_source_id, status) values (${userId}, ${jobId}, ${status})
        on conflict (user_id, job_source_id) do update set status = excluded.status
      `;
    }
    for (const item of state.contacts || []) {
      if (unchanged("contacts", item.id, item)) continue;
      await sql`
      insert into app.contacts (id, user_id, data) values (${item.id}, ${userId}, ${sql.json(item)})
      on conflict (user_id, id) do update set data = excluded.data
    `;
    }
    for (const item of state.cadences || []) {
      if (unchanged("cadences", item.id, item)) continue;
      const { steps, approvalStatus, ...data } = item;
      await sql`
        insert into app.cadences (id, user_id, contact_id, approval_status, data, approved_at)
        values (${item.id}, ${userId}, ${item.contactId || null}, ${approvalStatus || "draft"}, ${sql.json(data)}, ${item.approvedAt || null})
        on conflict (id) do update set approval_status = excluded.approval_status, data = excluded.data, approved_at = excluded.approved_at
        where app.cadences.user_id = ${userId}
      `;
      // Write only steps that changed. Rewriting untouched steps from this
      // snapshot could undo a step claim or outcome recorded meanwhile.
      const before = snapshot.steps.get(item.id);
      const rescheduled = !before || before.schedule !== JSON.stringify([approvalStatus, item.approvedAt]);
      for (const [index, step] of (steps || []).entries()) {
        if (!rescheduled && before?.steps[index] === JSON.stringify(step)) continue;
        const dueAt = item.createdAt && Number.isFinite(Number(step.day))
          ? new Date(new Date(item.createdAt).getTime() + Number(step.day) * 86400000)
          : null;
        await sql`
          insert into app.cadence_steps (cadence_id, user_id, step_index, status, due_at, data)
          values (${item.id}, ${userId}, ${index}, ${step.status || "pending"}, ${dueAt}, ${sql.json(step)})
          on conflict (cadence_id, step_index) do update
          set status = excluded.status, due_at = excluded.due_at, data = excluded.data
          where app.cadence_steps.user_id = ${userId}
        `;
      }
    }
    for (const item of state.pitchRefs || []) {
      if (unchanged("pitchRefs", item.slug, item)) continue;
      await sql`
      update app.pitches set reference = ${sql.json(item)} where slug = ${item.slug} and user_id = ${userId}
    `;
    }
    for (const item of state.applyKits || []) {
      if (unchanged("applyKits", item.id, item)) continue;
      await sql`
      insert into app.apply_kits (id, user_id, data) values (${item.id}, ${userId}, ${sql.json(item)})
      on conflict (id) do update set data = excluded.data where app.apply_kits.user_id = ${userId}
    `;
    }
    for (const item of state.socialPosts || []) {
      if (unchanged("socialPosts", item.id, item)) continue;
      await sql`
      insert into app.social_posts (id, user_id, data) values (${item.id}, ${userId}, ${sql.json(item)})
      on conflict (id) do update set data = excluded.data where app.social_posts.user_id = ${userId}
    `;
    }
    for (const [provider, data] of Object.entries(state.connections || {})) {
      if (!["gmail", "linkedin", "linkedinExt"].includes(provider)) continue;
      if (snapshot.connections[provider] === JSON.stringify(data)) continue;
      if (!data) {
        await sql`delete from app.integrations where user_id = ${userId} and provider = ${provider}`;
        continue;
      }
      await sql`
        insert into app.integrations (user_id, provider, data) values (${userId}, ${provider}, ${sql.json(data)})
        on conflict (user_id, provider) do update set data = excluded.data, updated_at = now()
      `;
    }
    for (const item of state.linkedinQueue || []) {
      if (unchanged("linkedinQueue", item.id, item)) continue;
      await sql`
      insert into app.extension_actions (id, user_id, status, data) values (${item.id}, ${userId}, ${item.status}, ${sql.json(item)})
      on conflict (id) do update set status = excluded.status, data = excluded.data where app.extension_actions.user_id = ${userId}
    `;
    }
    for (const item of state.sends || []) {
      if (unchanged("sends", item.id, item)) continue;
      await sql`
      insert into app.sends (id, user_id, cadence_id, data) values (${item.id}, ${userId}, ${item.cadenceId || null}, ${sql.json(item)})
      on conflict (id) do nothing
    `;
    }
    return result ?? state;
  });
}

export async function readJobPool() {
  const db = workerDb();
  const jobs = rowsData(await db`select data from app.jobs order by synced_at desc limit 1000`);
  const [sync] = await db`select synced_at, sources from app.job_syncs order by id desc limit 1`;
  return { jobs, lastSync: sync?.synced_at || null, sources: sync?.sources || {} };
}

export async function writeJobPool(pool) {
  await workerDb().begin(async (sql) => {
    for (const job of pool.jobs || []) await sql`
      insert into app.jobs (source_id, source, external_id, data, synced_at)
      values (${job.sourceId}, ${job.source || "unknown"}, ${job.externalId || job.sourceId}, ${sql.json(job)}, now())
      on conflict (source_id) do update set data = excluded.data, synced_at = now()
    `;
    await sql`insert into app.job_syncs (sources) values (${sql.json(pool.sources || {})})`;
  });
}

export async function readPitch(slug) {
  const [row] = await workerDb()`select data from app.pitches where slug = ${slug} and published = true`;
  return row?.data || null;
}

export async function writePitch(slug, pitch) {
  if (!pitch.userId) throw new Error("Pitch owner is required");
  await withUser(pitch.userId, (sql) => sql`
    insert into app.pitches (slug, user_id, data, published)
    values (${slug}, ${pitch.userId}, ${sql.json(pitch)}, true)
    on conflict (slug) do update set data = excluded.data where app.pitches.user_id = ${pitch.userId}
  `);
}

export async function readLinkedInOwner(accountId) {
  const [row] = await workerDb()`select user_id from app.unipile_accounts where account_id = ${accountId}`;
  return row?.user_id || null;
}

export async function claimLinkedInOwner(accountId, userId) {
  return withUser(userId, async (sql) => {
    const rows = await sql`
      insert into app.unipile_accounts (account_id, user_id) values (${accountId}, ${userId})
      on conflict (account_id) do update set user_id = excluded.user_id
      where app.unipile_accounts.user_id = excluded.user_id
      returning account_id
    `;
    return rows.length > 0;
  });
}

export async function releaseLinkedInOwner(accountId, userId) {
  const rows = await withUser(userId, (sql) => sql`
    delete from app.unipile_accounts where account_id = ${accountId} and user_id = ${userId} returning account_id
  `);
  return rows.length > 0;
}

export async function createUnipileCorrelation(userId) {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(nonce).digest();
  await withUser(userId, (sql) => sql`
    insert into app.unipile_correlations (nonce_hash, user_id, expires_at)
    values (${hash}, ${userId}, now() + interval '1 hour')
  `);
  return nonce;
}

export async function claimCorrelatedUnipileAccount(nonce, accountId) {
  if (!nonce || nonce.length > 128 || !accountId) return null;
  const hash = crypto.createHash("sha256").update(nonce).digest();
  return workerDb().begin(async (sql) => {
    const [correlation] = await sql`
      update app.unipile_correlations set consumed_at = now(), account_id = ${accountId}
      where nonce_hash = ${hash} and consumed_at is null and expires_at > now()
      returning user_id
    `;
    if (!correlation) return null;
    const [account] = await sql`
      insert into app.unipile_accounts (account_id, user_id)
      values (${accountId}, ${correlation.user_id})
      on conflict (account_id) do update set user_id = excluded.user_id
      where app.unipile_accounts.user_id = excluded.user_id
      returning account_id
    `;
    if (!account) throw new Error("Unipile account already claimed");
    return correlation.user_id;
  });
}

export async function suppressed(email) {
  const [row] = await workerDb()`select 1 from app.suppressions where email = ${email.toLowerCase().trim()}`;
  return !!row;
}

export async function suppress(email, reason) {
  const clean = email.toLowerCase().trim();
  await workerDb()`insert into app.suppressions (email, reason) values (${clean}, ${reason}) on conflict (email) do update set reason = excluded.reason`;
}

export async function grantStripeEvent(event, plan) {
  if (!event?.id || !plan || !event.userId) throw new Error("Invalid credit event");
  return workerDb().begin(async (sql) => {
    const rows = await sql`
      insert into app.provider_events (provider, event_id, event_type)
      values ('stripe', ${event.id}, ${event.type}) on conflict do nothing returning event_id
    `;
    if (!rows.length) return false;
    // mutateUserState writes credits from a snapshot under this lock; taking it
    // here keeps a concurrent hunt from overwriting the granted balance.
    const [owner] = await sql`select id from app.accounts where id = ${event.userId} for update`;
    if (!owner) throw new Error("Account not found");
    const [account] = await sql`
      update app.credit_accounts set plan = ${plan.key}, balance = balance + ${plan.credits}
      where user_id = ${event.userId} returning user_id
    `;
    if (!account) throw new Error("Credit account not found");
    await sql`
      insert into app.credit_ledger (user_id, delta, reference, reason)
      values (${event.userId}, ${plan.credits}, ${`stripe:${event.id}`}, ${event.type})
    `;
    return true;
  });
}

export async function recordResendEvent(eventId, type, recipients) {
  if (!eventId) throw new Error("Resend event ID is required");
  return workerDb().begin(async (sql) => {
    const rows = await sql`
      insert into app.provider_events (provider, event_id, event_type)
      values ('resend', ${eventId}, ${type}) on conflict do nothing returning event_id
    `;
    if (!rows.length) return false;
    if (type === "email.bounced" || type === "email.complained") {
      for (const address of recipients) {
        const email = String(address).toLowerCase().trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
        await sql`
          insert into app.suppressions (email, reason) values (${email}, ${type})
          on conflict (email) do update set reason = excluded.reason
        `;
      }
    }
    return true;
  });
}

export async function saveScoutLeadRecord(lead) {
  const email = String(lead.email).toLowerCase().trim();
  await workerDb()`
    insert into app.scout_leads (email, data) values (${email}, ${workerDb().json(lead)})
    on conflict (email) do update set data = excluded.data
  `;
}

export async function listScoutLeadEmails() {
  const rows = await workerDb()`select email from app.scout_leads order by created_at desc`;
  return rows.map((row) => row.email);
}
