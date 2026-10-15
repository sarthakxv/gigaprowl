-- Public v1. Runtime credentials are provisioned separately; this migration
-- never embeds a password or exposes app tables through the Data API.
create schema if not exists app;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'gigaprowl_app') then
    create role gigaprowl_app login noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'gigaprowl_worker') then
    create role gigaprowl_worker login noinherit;
  end if;
end $$;

revoke all on schema app from public, anon, authenticated;
grant usage on schema app to gigaprowl_app, gigaprowl_worker;

create function app.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create table app.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.profiles (
  user_id uuid primary key references app.accounts(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  media jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table app.settings (
  user_id uuid primary key references app.accounts(id) on delete cascade,
  outreach_mode text not null default 'manual' check (outreach_mode in ('manual', 'automated')),
  email_style text not null default 'standard' check (email_style in ('standard', 'founder_direct'))
);

create table app.jobs (
  source_id text primary key,
  source text not null,
  external_id text not null,
  data jsonb not null,
  synced_at timestamptz not null default now(),
  unique (source, external_id)
);

create table app.job_syncs (
  id bigint generated always as identity primary key,
  synced_at timestamptz not null default now(),
  sources jsonb not null default '{}'::jsonb
);

create table app.matches (
  user_id uuid not null references app.accounts(id) on delete cascade,
  job_source_id text not null references app.jobs(source_id) on delete cascade,
  status text not null default 'new',
  primary key (user_id, job_source_id)
);

create table app.hunts (
  id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  job_source_id text,
  kind text not null check (kind in ('full', 'lite')),
  status text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, job_source_id, kind)
);

create table app.contacts (
  id text not null,
  user_id uuid not null references app.accounts(id) on delete cascade,
  hunt_id text references app.hunts(id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table app.pitches (
  slug text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  data jsonb not null,
  reference jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table app.apply_kits (
  id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table app.social_posts (
  id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table app.cadences (
  id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  contact_id text,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'approved', 'paused')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  foreign key (user_id, contact_id) references app.contacts(user_id, id),
  unique (id, user_id)
);

create table app.cadence_steps (
  cadence_id text not null references app.cadences(id) on delete cascade,
  user_id uuid not null references app.accounts(id) on delete cascade,
  step_index integer not null check (step_index >= 0),
  status text not null default 'pending',
  due_at timestamptz,
  data jsonb not null,
  primary key (cadence_id, step_index),
  unique (cadence_id, step_index, user_id),
  foreign key (cadence_id, user_id) references app.cadences(id, user_id)
);

create table app.dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.accounts(id) on delete cascade,
  cadence_id text not null,
  step_index integer not null,
  status text not null check (status in ('reserved', 'sent', 'drafted', 'queued', 'uncertain', 'failed')),
  provider_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cadence_id, step_index, user_id) references app.cadence_steps(cadence_id, step_index, user_id)
);

create table app.sends (
  id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  cadence_id text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table app.integrations (
  user_id uuid not null references app.accounts(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'linkedin', 'linkedinExt')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table app.extension_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.accounts(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table app.extension_actions (
  id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  status text not null default 'pending',
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table app.unipile_accounts (
  account_id text primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table app.unipile_correlations (
  nonce_hash bytea primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  account_id text unique
);

create table app.credit_accounts (
  user_id uuid primary key references app.accounts(id) on delete cascade,
  plan text not null default 'free',
  balance integer not null default 0 check (balance >= 0),
  used integer not null default 0 check (used >= 0)
);

create table app.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references app.accounts(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reference text not null unique,
  reason text not null,
  created_at timestamptz not null default now()
);

create table app.provider_events (
  provider text not null check (provider in ('stripe', 'resend')),
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create table app.suppressions (
  email text primary key,
  reason text not null,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

create table app.scout_leads (
  email text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

-- Tenant scoping is a second line of defense behind verified server auth.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts', 'profiles', 'settings', 'matches', 'hunts', 'contacts',
    'pitches', 'apply_kits', 'social_posts', 'cadences', 'cadence_steps',
    'dispatch_attempts', 'sends', 'integrations', 'extension_credentials',
    'extension_actions', 'unipile_accounts', 'unipile_correlations',
    'credit_accounts', 'credit_ledger'
  ] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format(
      'create policy tenant on app.%I to gigaprowl_app using (%I = app.current_user_id()) with check (%I = app.current_user_id())',
      table_name, case when table_name = 'accounts' then 'id' else 'user_id' end,
      case when table_name = 'accounts' then 'id' else 'user_id' end
    );
    execute format('create policy worker on app.%I to gigaprowl_worker using (true) with check (true)', table_name);
  end loop;
end $$;

create index matches_job_idx on app.matches(job_source_id);
create index hunts_user_job_idx on app.hunts(user_id, job_source_id);
create index contacts_user_idx on app.contacts(user_id);
create index contacts_hunt_idx on app.contacts(hunt_id);
create index pitches_user_idx on app.pitches(user_id);
create index apply_kits_user_idx on app.apply_kits(user_id);
create index social_posts_user_idx on app.social_posts(user_id);
create index cadences_user_approval_idx on app.cadences(user_id, approval_status);
create index cadences_contact_idx on app.cadences(contact_id);
create index cadence_steps_due_idx on app.cadence_steps(user_id, status, due_at) where status = 'pending';
create index cadence_steps_due_global_idx on app.cadence_steps(due_at) where status = 'pending';
create index cadence_steps_user_idx on app.cadence_steps(user_id);
create index dispatch_attempts_step_idx on app.dispatch_attempts(cadence_id, step_index);
create index dispatch_attempts_user_idx on app.dispatch_attempts(user_id);
create index sends_user_idx on app.sends(user_id);
create index extension_credentials_user_idx on app.extension_credentials(user_id);
create index extension_actions_pending_idx on app.extension_actions(user_id, status) where status = 'pending';
create index unipile_accounts_user_idx on app.unipile_accounts(user_id);
create index unipile_correlations_user_idx on app.unipile_correlations(user_id);
create index credit_ledger_user_idx on app.credit_ledger(user_id, created_at desc);

grant select, insert, update, delete on all tables in schema app to gigaprowl_app, gigaprowl_worker;
grant usage, select on all sequences in schema app to gigaprowl_app, gigaprowl_worker;
revoke all on app.jobs, app.job_syncs, app.provider_events, app.suppressions, app.scout_leads from gigaprowl_app;
grant select on app.jobs, app.job_syncs, app.suppressions to gigaprowl_app;
revoke all on function app.current_user_id() from public;
grant execute on function app.current_user_id() to gigaprowl_app, gigaprowl_worker;
